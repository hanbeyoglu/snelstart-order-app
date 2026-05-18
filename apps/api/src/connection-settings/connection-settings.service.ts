import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ConnectionSettings,
  ConnectionSettingsDocument,
} from './schemas/connection-settings.schema';
import { EncryptionService } from './encryption.service';
import { SnelStartClient } from '../snelstart/snelstart.client';

/** Refresh when stored expiry is within this window (ms). */
export const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

export type TokenRefreshResult = {
  success: boolean;
  accessToken?: string;
  tokenExpiresAt?: Date;
  error?: string;
};

@Injectable()
export class ConnectionSettingsService {
  private readonly logger = new Logger(ConnectionSettingsService.name);
  private refreshPromise: Promise<TokenRefreshResult> | null = null;

  constructor(
    @InjectModel(ConnectionSettings.name)
    private connectionSettingsModel: Model<ConnectionSettingsDocument>,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
    @Inject(forwardRef(() => SnelStartClient))
    private snelStartClient: SnelStartClient,
  ) {}

  isRefreshInProgress(): boolean {
    return this.refreshPromise !== null;
  }

  async getActiveSettings(): Promise<ConnectionSettingsDocument | null> {
    const settings = await this.connectionSettingsModel.findOne({ isActive: true }).exec();

    if (!settings) {
      const envSubscriptionKey =
        this.configService.get<string>('SNELSTART_API_SUB_KEY') ||
        process.env.SNELSTART_API_SUB_KEY;
      const envIntegrationKey =
        this.configService.get<string>('SNELSTART_CLIENTKEY') ||
        process.env.SNELSTART_CLIENTKEY;

      if (envSubscriptionKey && envIntegrationKey) {
        return {
          subscriptionKey: envSubscriptionKey,
          integrationKey: envIntegrationKey,
          isActive: true,
        } as any as ConnectionSettingsDocument;
      }
      return null;
    }

    const decrypted = {
      ...settings.toObject(),
      subscriptionKey: this.encryptionService.decrypt(settings.subscriptionKey),
      integrationKey: this.encryptionService.decrypt(settings.integrationKey),
    };
    return decrypted as any as ConnectionSettingsDocument;
  }

  async getSettings(): Promise<ConnectionSettingsDocument | null> {
    return this.connectionSettingsModel.findOne({ isActive: true }).exec();
  }

  async saveSettings(
    subscriptionKey: string,
    integrationKey: string,
  ): Promise<ConnectionSettingsDocument> {
    const encryptedSubscriptionKey = this.encryptionService.encrypt(subscriptionKey);
    const encryptedIntegrationKey = this.encryptionService.encrypt(integrationKey);

    await this.connectionSettingsModel.updateMany({}, { isActive: false }).exec();

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

  /** Clears stored token and marks connection offline after unrecoverable auth failure. */
  async markConnectionInvalid(reason = 'SnelStart authentication failed'): Promise<void> {
    const settings = await this.connectionSettingsModel.findOne({ isActive: true }).exec();
    if (settings) {
      settings.accessToken = undefined;
      settings.tokenExpiresAt = new Date(0);
      await settings.save();
    }
    await this.updateTestStatus(false, reason);
    this.logger.warn(`SnelStart connection marked invalid: ${reason}`);
  }

  async saveAccessToken(accessToken: string, expiresIn: number): Promise<void> {
    let settings = await this.connectionSettingsModel.findOne({ isActive: true }).exec();

    if (!settings) {
      const envSubscriptionKey =
        this.configService.get<string>('SNELSTART_API_SUB_KEY') ||
        process.env.SNELSTART_API_SUB_KEY;
      const envIntegrationKey =
        this.configService.get<string>('SNELSTART_CLIENTKEY') ||
        process.env.SNELSTART_CLIENTKEY;

      if (envSubscriptionKey && envIntegrationKey) {
        await this.saveSettings(envSubscriptionKey, envIntegrationKey);
        settings = await this.connectionSettingsModel.findOne({ isActive: true }).exec();
      } else {
        this.logger.warn('Cannot save token: no connection settings in database or environment');
        return;
      }
    }

    if (!settings) {
      this.logger.warn('Cannot save token: settings could not be created or found');
      return;
    }

    const encryptedToken = this.encryptionService.encrypt(accessToken);
    const expiresAt = new Date(Date.now() + (expiresIn - 300) * 1000);
    settings.accessToken = encryptedToken;
    settings.tokenExpiresAt = expiresAt;
    await settings.save();
  }

  private tokenNeedsRefresh(tokenExpiresAt?: Date | null): boolean {
    if (!tokenExpiresAt) {
      return true;
    }
    const refreshBy = Date.now() + TOKEN_REFRESH_THRESHOLD_MS;
    return tokenExpiresAt.getTime() <= refreshBy;
  }

  /**
   * Obtain a fresh access token from SnelStart and persist it.
   * Concurrent callers share one in-flight refresh.
   */
  async refreshAccessToken(): Promise<TokenRefreshResult> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async performTokenRefresh(): Promise<TokenRefreshResult> {
    const settings = await this.getActiveSettings();
    if (!settings?.integrationKey) {
      return { success: false, error: 'Connection settings not found' };
    }

    try {
      const tokenResponse = await this.snelStartClient.getToken(settings.integrationKey);
      if (!tokenResponse?.access_token || !tokenResponse.expires_in) {
        this.logger.warn('SnelStart token refresh returned invalid response');
        return { success: false, error: 'Invalid token response' };
      }

      await this.saveAccessToken(tokenResponse.access_token, tokenResponse.expires_in);
      const updated = await this.getSettings();

      return {
        success: true,
        accessToken: tokenResponse.access_token,
        tokenExpiresAt: updated?.tokenExpiresAt,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Token refresh failed';
      this.logger.warn(`SnelStart token refresh failed: ${message}`);
      return { success: false, error: 'Token refresh failed' };
    }
  }

  /**
   * Returns a usable access token, refreshing automatically when expired or near expiry.
   */
  async getValidAccessToken(): Promise<string | null> {
    const settings = await this.connectionSettingsModel.findOne({ isActive: true }).exec();
    if (!settings?.accessToken) {
      const refreshed = await this.refreshAccessToken();
      return refreshed.success && refreshed.accessToken
        ? refreshed.accessToken
        : null;
    }

    if (!this.tokenNeedsRefresh(settings.tokenExpiresAt)) {
      return this.encryptionService.decrypt(settings.accessToken);
    }

    const refreshed = await this.refreshAccessToken();
    if (refreshed.success && refreshed.accessToken) {
      return refreshed.accessToken;
    }

    if (settings.tokenExpiresAt && settings.tokenExpiresAt > new Date()) {
      return this.encryptionService.decrypt(settings.accessToken);
    }

    return null;
  }

  async isTokenValid(): Promise<boolean> {
    const token = await this.getValidAccessToken();
    return token !== null;
  }
}
