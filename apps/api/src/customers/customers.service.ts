import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SnelStartService } from '../snelstart/snelstart.service';
import { CacheService } from '../cache/cache.service';
import { createCustomerSchema, updateCustomerSchema } from '@snelstart-order-app/shared';
import { CustomerVisit, CustomerVisitDocument } from './schemas/customer-visit.schema';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import * as crypto from 'crypto';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);
  private readonly CACHE_TTL = 1800; // 30 minutes - Increased for better performance
  private readonly DB_CACHE_TTL = 3600; // 1 hour for DB-only queries

  constructor(
    private snelStartService: SnelStartService,
    private cacheService: CacheService,
    @InjectModel(CustomerVisit.name) private customerVisitModel: Model<CustomerVisitDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
  ) {}

  async getCustomers(search?: string, cities?: string[], page: number = 1, limit: number = 20, includeAll: boolean = false) {
    const citiesKey = cities && cities.length > 0 ? cities.sort().join(',') : 'all';
    const includeAllKey = includeAll ? 'all' : 'klant';
    const cacheKey = `customers:${search || 'all'}:${citiesKey}:${includeAllKey}:${page}:${limit}`;
    
    // First check Redis cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug('Customers retrieved from Redis cache');
      return cached;
    }

    // Build query for DB
    const query: any = {};
    if (search) {
      const searchLower = search.toLowerCase();
      const searchNum = parseInt(search, 10);
      query.$or = [
        { naam: { $regex: searchLower, $options: 'i' } },
        { email: { $regex: searchLower, $options: 'i' } },
        ...(isNaN(searchNum) ? [] : [{ relatiecode: searchNum }]),
      ];
    }
    
    // Filter by cities (multiple)
    if (cities && cities.length > 0) {
      query['adres.plaats'] = { $in: cities };
    }

    // Filter by relatiesoort: only show 'Klant' if includeAll is false
    if (!includeAll) {
      query['extraVelden.relatiesoort'] = 'Klant';
    }

    // Get total count
    const total = await this.customerModel.countDocuments(query).exec();
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Get paginated results from DB (fast path - no API call)
    const dbCustomers = await this.customerModel
      .find(query)
      .sort({ naam: 1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const result = {
      data: dbCustomers.map((c) => this.mapDbToApiFormat(c)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    // Cache the result with longer TTL for DB-only queries
    await this.cacheService.set(cacheKey, result, this.DB_CACHE_TTL);
    
    // Background sync: Only sync if DB is empty or very old (async, non-blocking)
    const dbCount = await this.customerModel.countDocuments().exec();
    if (dbCount === 0 || (dbCount < 10 && !search)) {
      // Background sync without blocking the response
      this.syncCustomersInBackground(search).catch((err) => {
        this.logger.warn('Background customer sync failed:', err.message);
      });
    }

    return result;
  }

  /**
   * Background sync customers from API (non-blocking)
   */
  private async syncCustomersInBackground(search?: string): Promise<void> {
    try {
      this.logger.debug('Starting background customer sync');
      const allApiCustomers = await this.snelStartService.getCustomers(search);
      
      if (Array.isArray(allApiCustomers)) {
        // Sync in batches to avoid overwhelming the system
        const batchSize = 50;
        for (let i = 0; i < allApiCustomers.length; i += batchSize) {
          const batch = allApiCustomers.slice(i, i + batchSize);
          await Promise.all(
            batch.map((customer: any) => this.syncCustomerToDb(customer))
          );
        }
        this.logger.debug(`Background sync completed: ${allApiCustomers.length} customers`);
        
        // Invalidate cache after sync to refresh data
        await this.cacheService.invalidateCustomerCache();
      }
    } catch (error: any) {
      this.logger.error('Background customer sync error:', error.message);
      throw error;
    }
  }

  /**
   * Get list of all unique cities from customers
   */
  async getCities(): Promise<string[]> {
    const cacheKey = 'customers:cities';
    const cached = await this.cacheService.get<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const cities = await this.customerModel.distinct('adres.plaats').exec();
    const filteredCities = cities.filter((city) => city && city.trim() !== '');
    const sortedCities = filteredCities.sort();

    await this.cacheService.set(cacheKey, sortedCities, 3600); // 1 hour cache
    return sortedCities;
  }

  /**
   * Sync all customers from SnelStart API to DB
   */
  async syncCustomers(): Promise<void> {
    try {
      // Fetch all customers from API
      const allApiCustomers = await this.snelStartService.getCustomers();
      
      // Sync all customers to DB
      if (Array.isArray(allApiCustomers)) {
        await Promise.all(
          allApiCustomers.map((customer: any) => this.syncCustomerToDb(customer))
        );
      }
      
      // Invalidate cache
      await this.cacheService.invalidateCustomerCache();
    } catch (error) {
      this.logger.error('Error syncing customers:', error);
      throw error;
    }
  }

  /**
   * Syncs a customer from API to DB
   */
  private async syncCustomerToDb(apiCustomer: any): Promise<void> {
    try {
      const mappedData = this.mapApiToDbFormat(apiCustomer);
      const hash = this.calculateHash(mappedData);

      await this.customerModel.findOneAndUpdate(
        { snelstartId: apiCustomer.id },
        {
          ...mappedData,
          hash,
          lastSyncedAt: new Date(),
        },
        {
          upsert: true,
          new: true,
        },
      ).exec();
    } catch (error) {
      this.logger.error(`Failed to sync customer ${apiCustomer.id}:`, error);
    }
  }

  /**
   * Maps API customer data to DB schema format
   */
  private mapApiToDbFormat(apiCustomer: any): Partial<Customer> {
    // Extract only important fields, rest goes to extraVelden
    const {
      id,
      relatiecode,
      naam,
      email,
      telefoon,
      mobieleTelefoon,
      straat,
      postcode,
      plaats,
      land,
      vestigingsAdres,
      kvkNummer,
      btwNummer,
      nonactief,
      modifiedOn,
      relatiesoort,
      ...restFields
    } = apiCustomer;

    // Use vestigingsAdres if available, otherwise use direct fields
    const addressData = vestigingsAdres || {
      straat: straat,
      postcode: postcode,
      plaats: plaats,
      land: land,
    };

    return {
      snelstartId: id,
      relatiecode: relatiecode,
      naam: naam,
      email: email,
      telefoon: telefoon || mobieleTelefoon,
      adres: {
        straat: addressData.straat,
        postcode: addressData.postcode,
        plaats: addressData.plaats,
        landId: addressData.land?.id,
      },
      kvkNummer: kvkNummer,
      btwNummer: btwNummer,
      nonactief: nonactief || false,
      modifiedOn: modifiedOn ? new Date(modifiedOn) : undefined,
      extraVelden: {
        relatiesoort: relatiesoort,
        mobieleTelefoon: mobieleTelefoon,
        contactpersoon: vestigingsAdres?.contactpersoon,
        ...restFields,
      },
    };
  }

  /**
   * Maps DB customer to API format
   */
  private mapDbToApiFormat(dbCustomer: CustomerDocument): any {
    const result: any = {
      id: dbCustomer.snelstartId,
      relatiecode: dbCustomer.relatiecode,
      naam: dbCustomer.naam,
      email: dbCustomer.email,
      telefoon: dbCustomer.telefoon || '',
      // Frontend expects 'adres' (street), not 'straat'
      adres: dbCustomer.adres?.straat || '',
      straat: dbCustomer.adres?.straat || '',
      postcode: dbCustomer.adres?.postcode || '',
      plaats: dbCustomer.adres?.plaats || '',
      kvkNummer: dbCustomer.kvkNummer,
      btwNummer: dbCustomer.btwNummer,
      nonactief: dbCustomer.nonactief || false,
      modifiedOn: dbCustomer.modifiedOn,
    };

    // Add mobieleTelefoon from extraVelden if exists
    if (dbCustomer.extraVelden?.mobieleTelefoon) {
      result.mobieleTelefoon = dbCustomer.extraVelden.mobieleTelefoon;
    }

    // Add relatiesoort from extraVelden if exists
    if (dbCustomer.extraVelden?.relatiesoort) {
      result.relatiesoort = dbCustomer.extraVelden.relatiesoort;
    }

    // Add other extra fields (excluding already mapped ones)
    if (dbCustomer.extraVelden) {
      const { mobieleTelefoon: _, relatiesoort: __, ...otherExtraFields } = dbCustomer.extraVelden;
      Object.assign(result, otherExtraFields);
    }

    return result;
  }

  /**
   * Calculates hash for change detection (only important fields)
   */
  private calculateHash(data: any): string {
    // Exclude MongoDB, cache, and extraVelden from hash calculation
    const {
      hash,
      lastSyncedAt,
      extraVelden,
      _id,
      __v,
      createdAt,
      updatedAt,
      ...dataToHash
    } = data;

    // Hash only the important customer fields
    const dataString = JSON.stringify(dataToHash, Object.keys(dataToHash).sort());
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  async getCustomerById(id: string) {
    const cacheKey = `customer:${id}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Customer ${id} retrieved from cache`);
      return cached;
    }

    // First check DB
    let customer = await this.customerModel.findOne({ snelstartId: id }).exec();
    
    if (customer) {
      // Check if needs sync (hash changed or old)
      const apiCustomer = await this.snelStartService.getCustomerById(id);
      await this.syncCustomerToDb(apiCustomer);
      customer = await this.customerModel.findOne({ snelstartId: id }).exec();
    } else {
      // Not in DB, fetch from API and sync
      const apiCustomer = await this.snelStartService.getCustomerById(id);
      await this.syncCustomerToDb(apiCustomer);
      customer = await this.customerModel.findOne({ snelstartId: id }).exec();
    }

    const result = customer ? this.mapDbToApiFormat(customer) : null;
    if (result) {
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    }
    return result;
  }

  async getCustomerOrders(customerId: string) {
    const cacheKey = `customer-orders:${customerId}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug('Customer orders retrieved from cache');
      return cached;
    }

    try {
      const orders = await this.snelStartService.getSalesOrders(customerId);
      // Filter orders by customer ID (relatie.id)
      const filteredOrders = orders.filter((order: any) => 
        order.relatie?.id === customerId
      );
      
      await this.cacheService.set(cacheKey, filteredOrders, this.CACHE_TTL);
      return filteredOrders;
    } catch (error: any) {
      this.logger.error(`Error fetching customer orders: ${error.message}`);
      throw error;
    }
  }

  async getCustomerWithVisitStatus(id: string) {
    const customer = await this.getCustomerById(id);
    if (!customer) {
      return null;
    }
    
    const visitStatus = await this.customerVisitModel.findOne({ customerId: id }).exec();
    
    return {
      ...(customer as any),
      visitStatus: visitStatus?.status || null,
      visitedAt: visitStatus?.visitedAt,
      plannedAt: visitStatus?.plannedAt,
      notes: visitStatus?.notes,
    };
  }

  async updateCustomerVisitStatus(
    customerId: string,
    status: 'VISITED' | 'PLANNED',
    notes?: string,
  ) {
    const visit = await this.customerVisitModel.findOne({ customerId }).exec();
    
    const updateData: any = {
      status,
      notes,
    };

    if (status === 'VISITED') {
      updateData.visitedAt = new Date();
    } else if (status === 'PLANNED') {
      updateData.plannedAt = new Date();
    }

    if (visit) {
      Object.assign(visit, updateData);
      await visit.save();
      return visit;
    } else {
      const newVisit = new this.customerVisitModel({
        customerId,
        ...updateData,
      });
      await newVisit.save();
      return newVisit;
    }
  }

  async getVisitedCustomers(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const visits = await this.customerVisitModel
      .find({
        status: 'VISITED',
        visitedAt: { $gte: startDate },
      })
      .sort({ visitedAt: -1 })
      .exec();

    const customerIds = visits.map((v) => v.customerId);
    const customers = await this.customerModel.find({
      snelstartId: { $in: customerIds },
    }).exec();
    return customers.map((c) => this.mapDbToApiFormat(c));
  }

  async getPlannedCustomers() {
    const visits = await this.customerVisitModel
      .find({
        status: 'PLANNED',
      })
      .sort({ plannedAt: -1 })
      .exec();

    const customerIds = visits.map((v) => v.customerId);
    const customers = await this.customerModel.find({
      snelstartId: { $in: customerIds },
    }).exec();
    return customers.map((c) => this.mapDbToApiFormat(c));
  }

  async createCustomer(customerData: any) {
    try {
      this.logger.log('Creating customer with data:', JSON.stringify(customerData, null, 2));
      const validated = createCustomerSchema.parse(customerData);
      this.logger.log('Validated customer data:', JSON.stringify(validated, null, 2));
      
      const customer = await this.snelStartService.createCustomer(validated);
      
      // Invalidate cache
      await this.cacheService.delete('customers:*');
      this.logger.log('Customer created successfully:', customer.id);

      // Müşteri oluşturduktan sonra otomatik senkronizasyon (arka planda)
      this.syncCustomers()
        .then(() => this.logger.log('Customer sync triggered after create'))
        .catch((err) => this.logger.error('Error syncing customers after create:', err));

      return customer;
    } catch (error: any) {
      this.logger.error('Error creating customer:', error?.response?.data || error);

      // SnelStart spesifik hata: KVK numarası geçersiz
      const details = error?.response?.data;
      if (Array.isArray(details)) {
        const kvkError = details.find((d: any) => d?.errorCode === 'REL-0006');
        if (kvkError) {
          throw new Error('KVK numarası geçersiz. Lütfen geçerli bir KVK numarası giriniz.');
        }
      }

      if (error.name === 'ZodError') {
        throw new Error(
          `Validation error: ${error.errors
            .map((e: any) => `${e.path.join('.')}: ${e.message}`)
            .join(', ')}`,
        );
      }
      throw error;
    }
  }

  async deleteCustomer(id: string) {
    try {
      this.logger.log(`Deleting customer ${id} from SnelStart and local cache`);

      // Önce SnelStart tarafında sil
      await this.snelStartService.deleteCustomer(id);

      // Lokal DB'de bu müşteriye ait kayıtları temizle (varsa)
      await this.customerModel.deleteOne({ snelstartId: id }).exec();
      await this.customerVisitModel.deleteMany({ customerId: id }).exec();

      // Cache invalidation
      await this.cacheService.delete('customers:*');
      this.logger.log(`Customer ${id} deleted successfully`);

      // Müşteri sildikten sonra otomatik senkronizasyon (arka planda)
      this.syncCustomers()
        .then(() => this.logger.log('Customer sync triggered after delete'))
        .catch((err) => this.logger.error('Error syncing customers after delete:', err));

      return { success: true };
    } catch (error: any) {
      this.logger.error(`Error deleting customer ${id}:`, error);
      throw error;
    }
  }

  async updateCustomer(id: string, customerData: any) {
    try {
      this.logger.log(`Updating customer ${id} with data: ${JSON.stringify(customerData, null, 2)}`);

      const validated = updateCustomerSchema.parse(customerData);

      // Önce mevcut müşteriyi SnelStart'tan al (gerekli alanları korumak için)
      const existing = await this.snelStartService.getCustomerById(id);

      // vestigingsAdres gibi nested alanları merge et
      const mergedPayload: any = {
        ...existing,
        ...validated,
      };

      if (validated.vestigingsAdres) {
        mergedPayload.vestigingsAdres = {
          ...(existing as any).vestigingsAdres,
          ...validated.vestigingsAdres,
        };
      }

      // SnelStart tarafında güncelle
      const updatedFromApi = await this.snelStartService.updateCustomer(id, mergedPayload);

      // DB ile tekrar senkronize et
      await this.syncCustomerToDb(updatedFromApi);

      // Cache temizle
      await this.cacheService.delete('customers:*');
      await this.cacheService.delete(`customer:${id}`);

      // Arka planda genel sync tetikle
      this.syncCustomers()
        .then(() => this.logger.log('Customer sync triggered after update'))
        .catch((err) => this.logger.error('Error syncing customers after update:', err));

      return this.getCustomerById(id);
    } catch (error: any) {
      this.logger.error(
        `Error updating customer ${id}:`,
        error?.response?.data || error,
      );

      // SnelStart spesifik hata: KVK numarası geçersiz
      const details = error?.response?.data;
      if (Array.isArray(details)) {
        const kvkError = details.find((d: any) => d?.errorCode === 'REL-0006');
        if (kvkError) {
          throw new Error('KVK numarası geçersiz. Lütfen geçerli bir KVK numarası giriniz.');
        }
      }

      if (error.name === 'ZodError') {
        throw new Error(
          `Validation error: ${error.errors
            .map((e: any) => `${e.path.join('.')}: ${e.message}`)
            .join(', ')}`,
        );
      }
      throw error;
    }
  }
}

