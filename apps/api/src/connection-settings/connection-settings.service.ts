import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ConnectionSettings,
  ConnectionSettingsDocument,
} from './schemas/connection-settings.schema';
import { EncryptionService } from './encryption.service';

@Injectable()
export class ConnectionSettingsService {
  constructor(
    @InjectModel(ConnectionSettings.name)
    private connectionSettingsModel: Model<ConnectionSettingsDocument>,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {}

  async getActiveSettings(): Promise<ConnectionSettingsDocument | null> {
    const settings = await this.connectionSettingsModel.findOne({ isActive: true }).exec();
    
    // If no settings in DB, use env variables
    if (!settings) {
      // ConfigService kullanarak env değişkenlerini oku
      const envSubscriptionKey = this.configService.get<string>('SNELSTART_API_SUB_KEY') || process.env.SNELSTART_API_SUB_KEY;
      const envIntegrationKey = this.configService.get<string>('SNELSTART_CLIENTKEY') || process.env.SNELSTART_CLIENTKEY;
      
      if (envSubscriptionKey && envIntegrationKey) {
        return {
          subscriptionKey: envSubscriptionKey,
          integrationKey: envIntegrationKey,
          isActive: true,
        } as any as ConnectionSettingsDocument;
      }
      return null;
    }

    // Decrypt keys
    const decrypted = {
      ...settings.toObject(),
      subscriptionKey: this.encryptionService.decrypt(settings.subscriptionKey),
      integrationKey: this.encryptionService.decrypt(settings.integrationKey),
    };
    return decrypted as any as ConnectionSettingsDocument;
  }

  async getSettings(): Promise<ConnectionSettingsDocument | null> {
    const settings = await this.connectionSettingsModel.findOne({ isActive: true }).exec();
    return settings;
  }

  async saveSettings(
    subscriptionKey: string,
    integrationKey: string,
  ): Promise<ConnectionSettingsDocument> {
    // Encrypt keys
    const encryptedSubscriptionKey = this.encryptionService.encrypt(subscriptionKey);
    const encryptedIntegrationKey = this.encryptionService.encrypt(integrationKey);

    // Deactivate all existing settings
    await this.connectionSettingsModel.updateMany({}, { isActive: false }).exec();

    // Create new active settings
    const settings = new this.connectionSettingsModel({
      subscriptionKey: encryptedSubscriptionKey,
      integrationKey: encryptedIntegrationKey,
      isActive: true,
    });

    return settings.save();
  }

  async updateTestStatus(success: boolean, error?: string): Promise<void> {
    const settings = await this.connectionSettingsModel.findOne({ isActive: true }).exec();
    if (settings) {
      settings.lastTestedAt = new Date();
      settings.lastTestStatus = success ? 'success' : 'failed';
      settings.lastTestError = error;
      await settings.save();
    }
  }

  async saveAccessToken(accessToken: string, expiresIn: number): Promise<void> {
    let settings = await this.connectionSettingsModel.findOne({ isActive: true }).exec();
    
    // Eğer database'de settings yoksa, env'den al ve database'e kaydet
    if (!settings) {
      const envSubscriptionKey = this.configService.get<string>('SNELSTART_API_SUB_KEY') || process.env.SNELSTART_API_SUB_KEY;
      const envIntegrationKey = this.configService.get<string>('SNELSTART_CLIENTKEY') || process.env.SNELSTART_CLIENTKEY;
      
      if (envSubscriptionKey && envIntegrationKey) {
        // Settings'i database'e kaydet
        await this.saveSettings(envSubscriptionKey, envIntegrationKey);
        // Kaydedilen settings'i tekrar çek
        settings = await this.connectionSettingsModel.findOne({ isActive: true }).exec();
      } else {
        // Settings yok ve env'de de yok, token kaydedilemez
        console.warn('Cannot save token: No connection settings found in database or environment');
        return;
      }
    }
    
    // Settings hala yoksa token kaydedilemez
    if (!settings) {
      console.warn('Cannot save token: Settings could not be created or found');
      return;
    }
    
    // Token'ı kaydet
    const encryptedToken = this.encryptionService.encrypt(accessToken);
    const expiresAt = new Date(Date.now() + (expiresIn - 300) * 1000); // 5 dakika önceden expire et
    settings.accessToken = encryptedToken;
    settings.tokenExpiresAt = expiresAt;
    await settings.save();
  }

  async getValidAccessToken(): Promise<string | null> {
    const settings = await this.connectionSettingsModel.findOne({ isActive: true }).exec();
    if (!settings || !settings.accessToken) {
      return null;
    }

    // Check if token is expired or will expire soon (within 5 minutes)
    if (settings.tokenExpiresAt && settings.tokenExpiresAt <= new Date()) {
      return null;
    }

    return this.encryptionService.decrypt(settings.accessToken);
  }

  async isTokenValid(): Promise<boolean> {
    const settings = await this.connectionSettingsModel.findOne({ isActive: true }).exec();
    if (!settings || !settings.accessToken || !settings.tokenExpiresAt) {
      return false;
    }
    return settings.tokenExpiresAt > new Date();
  }
}

