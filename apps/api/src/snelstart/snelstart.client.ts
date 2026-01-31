import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import Bottleneck from 'bottleneck';
import {
  SnelStartProduct,
  SnelStartProductGroup,
  SnelStartCustomer,
  SnelStartSalesOrder,
  SnelStartArtikelOmzetGroep,
} from '@snelstart-order-app/shared';
import { ConnectionSettingsService } from '../connection-settings/connection-settings.service';

@Injectable()
export class SnelStartClient {
  private readonly logger = new Logger(SnelStartClient.name);
  private axiosInstance: AxiosInstance;
  private limiter: Bottleneck;
  private mockMode: boolean;

  constructor(private connectionSettingsService: ConnectionSettingsService) {
    this.mockMode = process.env.SNELSTART_MOCK === 'true';
    const maxConcurrent = parseInt(process.env.SNELSTART_MAX_CONCURRENT || '5');
    this.limiter = new Bottleneck({ maxConcurrent });
    this.initializeAxios();
  }

  /**
   * Get access token from SnelStart auth endpoint
   */
  async getToken(
    integrationKey: string,
  ): Promise<{ access_token: string; expires_in: number }> {
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'clientkey');
      params.append('clientkey', integrationKey);
  
      const authUrl =
        process.env.SNELSTART_API_AUTH_URL ||
        'https://auth.snelstart.nl/b2b/token';
  
      const response = await axios.post(authUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
  
      return response.data;
    } catch (error: any) {
      this.logger.error(
        'Failed to get token',
        error.response?.data,
      );
      throw new Error(
        `Token alınamadı: ${
          error.response?.data?.error || error.message
        }`,
      );
    }
  }

  private initializeAxios() {
    // Base URL without /v2, endpoints will include /v2 prefix
    const baseURL = process.env.SNELSTART_API_BASE_URL || 'https://b2bapi.snelstart.nl';

    this.axiosInstance = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth headers
    this.axiosInstance.interceptors.request.use(async (config) => {
      if (!this.mockMode) {
        const settings = await this.connectionSettingsService.getActiveSettings();
        
        // Use SNELSTART_API_SUB_KEY from settings or env
        const subscriptionKey = settings?.subscriptionKey || process.env.SNELSTART_API_SUB_KEY;
        if (subscriptionKey) {
          config.headers['Ocp-Apim-Subscription-Key'] = subscriptionKey;
        }
        
        // Get valid access token (refresh if needed)
        const accessToken = await this.connectionSettingsService.getValidAccessToken();
        if (accessToken) {
          config.headers['Authorization'] = `Bearer ${accessToken}`;
          config.headers['Accept'] = 'application/json';
        }
      }
      return config;
    });

    // Response interceptor for logging and retry
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.debug(
          `SnelStart API ${response.config.method?.toUpperCase()} ${response.config.url} - ${
            response.status
          }`
        );
        return response;
      },
      async (error: AxiosError) => {
        this.logger.error(
          `SnelStart API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${
            error.response?.status
          } ${error.message}`
        );
        throw error;
      }
    );
  }

  private async requestWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.limiter.schedule(fn);
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;

        // Retry on 429 (rate limit) or 5xx errors
        if (status === 429 || (status >= 500 && status < 600)) {
          const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000; // Exponential backoff + jitter
          this.logger.warn(`Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Don't retry on 4xx errors (except 429)
        throw error;
      }
    }

    throw lastError!;
  }

  // Product Groups (Categories)
  async getProductGroups(): Promise<SnelStartProductGroup[]> {
    if (this.mockMode) {
      return this.getMockProductGroups();
    }

    return this.requestWithRetry(async () => {
      // TODO: Replace with actual SnelStart endpoint
      // Expected: GET /v2/artikelgroepen
      const response = await this.axiosInstance.get('/v2/artikelgroepen');
      return response.data;
    });
  }

  async getProductGroupById(id: string): Promise<SnelStartProductGroup> {
    if (this.mockMode) {
      return this.getMockProductGroups().find((g) => g.id === id)!;
    }

    return this.requestWithRetry(async () => {
      // TODO: Replace with actual SnelStart endpoint
      const response = await this.axiosInstance.get(`/v2/artikelgroepen/${id}`);
      return response.data;
    });
  }

  // Artikel Omzet Groepen (Categories from /v2/artikelen or /v2/artikelomzetgroepen)
  async getArtikelOmzetGroepen(): Promise<SnelStartArtikelOmzetGroep[]> {
    if (this.mockMode) {
      return this.getMockArtikelOmzetGroepen();
    }

    return this.requestWithRetry(async () => {
      // Try /v2/artikelen first (as user mentioned categories come from here)
      // If it doesn't return the expected format, try /v2/artikelomzetgroepen
      try {
        const response = await this.axiosInstance.get('/v2/artikelen');
        const data = response.data;
        
        // Check if response contains artikelomzetgroepen format
        if (Array.isArray(data) && data.length > 0) {
          // Check if first item has artikelomzetgroepen structure
          const firstItem = data[0];
          if (firstItem.uri && firstItem.uri.includes('artikelomzetgroepen')) {
            // This is artikelomzetgroepen data
            return data;
          }
        }
        
        // If not artikelomzetgroepen format, try the dedicated endpoint
        const artikelOmzetResponse = await this.axiosInstance.get('/v2/artikelomzetgroepen');
        return artikelOmzetResponse.data;
      } catch (error: any) {
        // If /v2/artikelen doesn't work, try /v2/artikelomzetgroepen
        if (error.response?.status === 404 || error.response?.status >= 400) {
          try {
            const response = await this.axiosInstance.get('/v2/artikelomzetgroepen');
            return response.data;
          } catch (secondError: any) {
            // If both fail, throw the original error
            throw error;
          }
        }
        throw error;
      }
    });
  }

  // Products (Articles)
  async getProducts(groupId?: string, search?: string): Promise<SnelStartProduct[]> {
    if (this.mockMode) {
      return this.getMockProducts().filter((p) => {
        if (groupId && p.artikelgroepId !== groupId) return false;
        if (search) {
          const searchLower = search.toLowerCase();
          return (
            p.omschrijving.toLowerCase().includes(searchLower) ||
            p.artikelnummer.toLowerCase().includes(searchLower) ||
            p.barcode?.toLowerCase().includes(searchLower)
          );
        }
        return true;
      });
    }

    return this.requestWithRetry(async () => {
      // TODO: Replace with actual SnelStart endpoint
      // Expected: GET /v2/artikelen?artikelgroepId={groupId}&zoek={search}
      const params: any = {};
      if (groupId) params.artikelgroepId = groupId;
      if (search) params.zoek = search;

      const response = await this.axiosInstance.get('/v2/artikelen', { params });
      return response.data;
    });
  }

  async getProductById(id: string): Promise<SnelStartProduct> {
    if (this.mockMode) {
      return this.getMockProducts().find((p) => p.id === id)!;
    }

    return this.requestWithRetry(async () => {
      // TODO: Replace with actual SnelStart endpoint
      const response = await this.axiosInstance.get(`/v2/artikelen/${id}`);
      return response.data;
    });
  }

  // Customers (Relations)
  async getCustomers(search?: string): Promise<SnelStartCustomer[]> {
    if (this.mockMode) {
      return this.getMockCustomers().filter((c) => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
          c.naam.toLowerCase().includes(searchLower) ||
          c.relatiecode?.toLowerCase().includes(searchLower) ||
          c.email?.toLowerCase().includes(searchLower)
        );
      });
    }

    return this.requestWithRetry(async () => {
      // TODO: Replace with actual SnelStart endpoint
      // Expected: GET /v2/relaties?zoek={search}
      const params: any = {};
      if (search) params.zoek = search;

      const response = await this.axiosInstance.get('/v2/relaties', { params });
      return response.data;
    });
  }

  async getCustomerById(id: string): Promise<SnelStartCustomer> {
    if (this.mockMode) {
      return this.getMockCustomers().find((c) => c.id === id)!;
    }

    return this.requestWithRetry(async () => {
      // TODO: Replace with actual SnelStart endpoint
      const response = await this.axiosInstance.get(`/v2/relaties/${id}`);
      return response.data;
    });
  }

  async createCustomer(customer: Partial<SnelStartCustomer>): Promise<SnelStartCustomer> {
    if (this.mockMode) {
      const newCustomer: SnelStartCustomer = {
        id: `mock-${Date.now()}`,
        naam: customer.naam!,
        ...customer,
      };
      return newCustomer;
    }

      console.log("🚀 ~ SnelStartClient ~ createCustomer ~ customer:", customer)
    return this.requestWithRetry(async () => {
      // TODO: Replace with actual SnelStart endpoint
      // Expected: POST /v2/relaties
      const response = await this.axiosInstance.post('/v2/relaties', customer);
      console.log("🚀 ~ SnelStartClient ~ createCustomer ~ response:", response)
      return response.data;
    });
  }

  async updateCustomer(id: string, customer: any): Promise<any> {
    if (this.mockMode) {
      this.logger.warn(`Mock updateCustomer called for id=${id}`);
      return {
        id,
        ...customer,
      };
    }

    return this.requestWithRetry(async () => {
      // Expected: PUT /v2/relaties/{id}
      const response = await this.axiosInstance.put(`/v2/relaties/${id}`, customer);
      return response.data;
    });
  }

  // Sales Orders
  async createSalesOrder(order: SnelStartSalesOrder): Promise<SnelStartSalesOrder> {
    if (this.mockMode) {
      return {
        ...order,
        id: `mock-order-${Date.now()}`,
      };
    }

    return this.requestWithRetry(async () => {
      // TODO: Replace with actual SnelStart endpoint
      // Expected: POST /v2/verkooporders
      const response = await this.axiosInstance.post('/v2/verkooporders', order);
      return response.data;
    });
  }

  async getSalesOrders(customerId?: string): Promise<any[]> {
    if (this.mockMode) {
      return [];
    }

    return this.requestWithRetry(async () => {
      const params: any = {};
      if (customerId) {
        params.relatie = customerId;
      }
      const response = await this.axiosInstance.get('/v2/verkooporders', { params });
      return Array.isArray(response.data) ? response.data : [];
    });
  }

  // Delete Customer (Relation)
  async deleteCustomer(id: string): Promise<void> {
    if (this.mockMode) {
      this.logger.warn(`Mock deleteCustomer called for id=${id}`);
      return;
    }

    return this.requestWithRetry(async () => {
      // Expected: DELETE /v2/relaties/{id}
      await this.axiosInstance.delete(`/v2/relaties/${id}`);
    });
  }

  // Test Connection - Get token and test
  async testConnection(subscriptionKey: string, integrationKey: string): Promise<boolean> {
    if (this.mockMode) {
      return true;
    }

    try {
      // Get token first
      const tokenResponse = await this.getToken(integrationKey);
      const accessToken = tokenResponse.access_token;

      // Save token to settings
      const settings = await this.connectionSettingsService.getActiveSettings();
      if (settings) {
        await this.connectionSettingsService.saveAccessToken(accessToken, tokenResponse.expires_in);
      }

      // Test with companyInfo endpoint
      const testAxios = axios.create({
        baseURL: process.env.SNELSTART_API_BASE_URL || 'https://b2bapi.snelstart.nl',
        timeout: 10000,
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Accept': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      await testAxios.get('/v2/companyInfo');
      return true;
    } catch (error: any) {
      this.logger.error(`Connection test failed: ${error.message}`);
      return false;
    }
  }

  // Get Company Info
  async getCompanyInfo(): Promise<any> {
    if (this.mockMode) {
      return {
        naam: 'DHY Food BV',
        kvkNummer: '12345678',
        btwNummer: 'NL123456789B01',
        adres: 'Teststraat 123',
        postcode: '1000AA',
        plaats: 'Amsterdam',
      };
    }

    return this.requestWithRetry(async () => {
      const response = await this.axiosInstance.get('/v2/companyInfo');
      return response.data;
    });
  }

  // Mock Data
  private getMockProductGroups(): SnelStartProductGroup[] {
    return [
      { id: '1', omschrijving: 'İçecekler', niveau: 1 },
      { id: '2', omschrijving: 'Makarnalar', parentId: '1', niveau: 2 },
      { id: '3', omschrijving: 'Temel Gıdalar', niveau: 1 },
      { id: '4', omschrijving: 'Pirinç', parentId: '3', niveau: 2 },
    ];
  }

  private getMockProducts(): SnelStartProduct[] {
    return [
      {
        id: 'p1',
        artikelnummer: 'SKU001',
        omschrijving: 'Premium Makarna 500g',
        artikelgroepId: '2',
        artikelgroepOmschrijving: 'Makarnalar',
        voorraad: 100,
        verkoopprijs: 5.99,
        btwPercentage: 21,
        eenheid: 'stuk',
        barcode: '1234567890123',
      },
      {
        id: 'p2',
        artikelnummer: 'SKU002',
        omschrijving: 'Organik Pirinç 1kg',
        artikelgroepId: '4',
        artikelgroepOmschrijving: 'Pirinç',
        voorraad: 50,
        verkoopprijs: 8.99,
        btwPercentage: 21,
        eenheid: 'stuk',
        barcode: '1234567890124',
      },
    ];
  }

  private getMockCustomers(): SnelStartCustomer[] {
    return [
      {
        id: 'c1',
        relatiecode: 'CUST001',
        naam: 'ABC Market',
        adres: 'Main Street 123',
        postcode: '1000AA',
        plaats: 'Amsterdam',
        land: 'NL',
        telefoon: '+31201234567',
        email: 'info@abcmarket.nl',
      },
      {
        id: 'c2',
        relatiecode: 'CUST002',
        naam: 'XYZ Wholesale',
        adres: 'Business Park 456',
        postcode: '2000BB',
        plaats: 'Rotterdam',
        land: 'NL',
        telefoon: '+31209876543',
        email: 'contact@xyzwholesale.nl',
      },
    ];
  }

  private getMockArtikelOmzetGroepen(): SnelStartArtikelOmzetGroep[] {
    return [
      {
        nummer: 1,
        omschrijving: 'Hoog btw (goederen)',
        verkoopGrootboekNederlandIdentifier: {
          id: '1bbff24e-0fcf-40c3-8fdc-9c39f4c2f103',
          uri: '/grootboeken/1bbff24e-0fcf-40c3-8fdc-9c39f4c2f103',
        },
        verkoopNederlandBtwSoort: 'Hoog',
        id: '16cfd34f-6ec9-4335-bb09-34da92518871',
        uri: '/artikelomzetgroepen/16cfd34f-6ec9-4335-bb09-34da92518871',
      },
      {
        nummer: 2,
        omschrijving: 'Laag btw (goederen)',
        verkoopGrootboekNederlandIdentifier: {
          id: 'b12bf975-2c63-42d8-a11f-57036dd92da9',
          uri: '/grootboeken/b12bf975-2c63-42d8-a11f-57036dd92da9',
        },
        verkoopNederlandBtwSoort: 'Laag',
        id: 'a1ce9b60-981c-4b68-8214-061211b6076d',
        uri: '/artikelomzetgroepen/a1ce9b60-981c-4b68-8214-061211b6076d',
      },
    ];
  }
}
