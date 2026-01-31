import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SnelStartService } from '../snelstart/snelstart.service';
import { CacheService } from '../cache/cache.service';
import {
  CompanyInfo,
  CompanyInfoDocument,
} from './schemas/company-info.schema';
import * as crypto from 'crypto';

@Injectable()
export class CompanyInfoService {
  private readonly logger = new Logger(CompanyInfoService.name);
  private readonly CACHE_KEY = 'company:info';
  private readonly CACHE_TTL = 86400; // 24 saat (saniye cinsinden)

  constructor(
    @InjectModel(CompanyInfo.name)
    private companyInfoModel: Model<CompanyInfoDocument>,
    private snelStartService: SnelStartService,
    private cacheService: CacheService,
  ) {}

  /**
   * Fetches company info from cache, DB, or API
   */
  async getCompanyInfo(): Promise<CompanyInfoDocument> {
    // First check Redis cache
    const cached = await this.cacheService.get<CompanyInfoDocument>(
      this.CACHE_KEY,
    );
    if (cached) {
      this.logger.debug('Company info retrieved from cache');
      return cached;
    }

    // If not in cache, check DB
    let companyInfo = await this.companyInfoModel.findOne().exec();

    // If exists in DB and hash hasn't changed, cache and return
    if (companyInfo) {
      const currentHash = this.calculateHash(companyInfo.toObject());
      if (companyInfo.dataHash === currentHash) {
        // No changes, cache and return
        await this.cacheService.set(
          this.CACHE_KEY,
          companyInfo.toObject(),
          this.CACHE_TTL,
        );
        this.logger.debug('Company info retrieved from DB (no changes)');
        return companyInfo;
      }
    }

    // Not in DB or changed, fetch from API
    this.logger.log('Fetching company info from SnelStart API');
    const apiData = await this.snelStartService.getCompanyInfo();

    // Map API data to schema format
    const mappedData = this.mapApiDataToSchema(apiData);

    // Calculate new hash (only company info fields)
    const newHash = this.calculateHash(mappedData);

    // If record exists in DB and hash is same, only update lastFetchedAt
    if (companyInfo && companyInfo.dataHash === newHash) {
      companyInfo.lastFetchedAt = new Date();
      await companyInfo.save();
    } else {
      // Create new record or update existing
      companyInfo = await this.companyInfoModel.findOneAndUpdate(
        {},
        {
          ...mappedData,
          dataHash: newHash,
          lastFetchedAt: new Date(),
        },
        {
          upsert: true,
          new: true,
        },
      ).exec();
    }

    // Save to cache
    await this.cacheService.set(
      this.CACHE_KEY,
      companyInfo.toObject(),
      this.CACHE_TTL,
    );

    this.logger.log('Company info saved to DB and cache');
    return companyInfo;
  }

  /**
   * Invalidates cache (for manual refresh)
   */
  async invalidateCache(): Promise<void> {
    await this.cacheService.delete(this.CACHE_KEY);
    this.logger.log('Company info cache invalidated');
  }

  /**
   * Manually refreshes company info from API
   */
  async refreshCompanyInfo(): Promise<CompanyInfoDocument> {
    // Clear cache
    await this.invalidateCache();

    // Fetch and update from API
    return this.getCompanyInfo();
  }

  /**
   * Maps API data to schema format
   */
  private mapApiDataToSchema(apiData: any): Partial<CompanyInfo> {
    return {
      administrationId: apiData.administratieIdentifier || '',
      companyName: apiData.bedrijfsnaam || apiData.administratieNaam || '',
      contactPerson: apiData.contactpersoon,
      address: apiData.adres,
      postalCode: apiData.postcode,
      city: apiData.plaats,
      phone: apiData.telefoon || apiData.mobieleTelefoon,
      email: apiData.email,
      website: apiData.website,
      iban: apiData.iban,
      bic: apiData.bic,
      vatNumber: apiData.btwNummer,
      kvkNumber: apiData.kvKNummer,
      rawData: apiData, // Store all raw data for reference
    };
  }

  /**
   * Calculates data hash for change detection
   */
  private calculateHash(data: any): string {
    // Exclude MongoDB and cache fields from hash calculation
    const {
      rawData,
      lastFetchedAt,
      dataHash,
      _id,
      __v,
      createdAt,
      updatedAt,
      ...dataToHash
    } = data;

    // Hash only company info fields
    const dataString = JSON.stringify(dataToHash, Object.keys(dataToHash).sort());
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }
}
