import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConnectionSettingsService } from './connection-settings.service';
import { SnelStartService } from '../snelstart/snelstart.service';
import { CompanyInfoService } from '../company-info/company-info.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { snelStartConnectionTestSchema } from '@snelstart-order-app/shared';

@ApiTags('Connection Settings')
@Controller('connection-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ConnectionSettingsController {
  constructor(
    private connectionSettingsService: ConnectionSettingsService,
    private snelStartService: SnelStartService,
    private companyInfoService: CompanyInfoService,
  ) {}

  @Get()
  @Roles('admin', 'sales_rep')
  @ApiOperation({ summary: 'Get SnelStart connection settings status (available to all authenticated users)' })
  async getSettings() {
    const settings = await this.connectionSettingsService.getSettings();
    if (!settings) {
      return { exists: false, isTokenValid: false };
    }
    const isTokenValid = await this.connectionSettingsService.isTokenValid();
    return {
      exists: true,
      isActive: settings.isActive,
      lastTestedAt: settings.lastTestedAt,
      lastTestStatus: settings.lastTestStatus,
      lastTestError: settings.lastTestError,
      isTokenValid,
      tokenExpiresAt: settings.tokenExpiresAt,
    };
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Save SnelStart connection settings' })
  async saveSettings(
    @Body()
    body: {
      subscriptionKey: string;
      integrationKey: string;
    },
  ) {
    const validated = snelStartConnectionTestSchema.parse(body);
    await this.connectionSettingsService.saveSettings(
      validated.subscriptionKey,
      validated.integrationKey,
    );
    return { success: true };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  @ApiOperation({ summary: 'Test SnelStart connection' })
  async testConnection(
    @Body()
    body: {
      subscriptionKey: string;
      integrationKey: string;
    },
  ) {
    const validated = snelStartConnectionTestSchema.parse(body);
    try {
      const success = await this.snelStartService.testConnection(
        validated.subscriptionKey,
        validated.integrationKey,
      );
      await this.connectionSettingsService.updateTestStatus(success);
      
      // If connection test is successful, fetch company info automatically
      if (success) {
        try {
          await this.companyInfoService.getCompanyInfo();
        } catch (error) {
          // Log error but don't fail the connection test
          console.error('Failed to fetch company info after connection test:', error);
        }
      }
      
      return { success };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      await this.connectionSettingsService.updateTestStatus(false, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'sales_rep')
  @ApiOperation({ summary: 'Refresh SnelStart access token (available to all authenticated users)' })
  async refreshToken() {
    const settings = await this.connectionSettingsService.getActiveSettings();
    if (!settings) {
      return { success: false, error: 'Connection settings not found' };
    }
    if (!settings.integrationKey) {
      return { success: false, error: 'Integration key not found' };
    }
    try {
      const tokenResponse = await this.snelStartService.getToken(settings.integrationKey);
      if (tokenResponse && tokenResponse.access_token && tokenResponse.expires_in) {
        await this.connectionSettingsService.saveAccessToken(
          tokenResponse.access_token,
          tokenResponse.expires_in,
        );
        
        // After token is saved, fetch company info automatically
        try {
          await this.companyInfoService.getCompanyInfo();
        } catch (error) {
          // Log error but don't fail the token refresh
          console.error('Failed to fetch company info after token refresh:', error);
        }
        
        // Token kaydedildikten sonra güncel durumu döndür
        const isTokenValid = await this.connectionSettingsService.isTokenValid();
        const updatedSettings = await this.connectionSettingsService.getSettings();
        return { 
          success: true,
          isTokenValid,
          tokenExpiresAt: updatedSettings?.tokenExpiresAt,
        };
      }
      return { success: false, error: 'Invalid token response' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Get('company-info')
  @Roles('admin')
  @ApiOperation({ summary: 'Get company information from SnelStart' })
  async getCompanyInfo() {
    try {
      const companyInfo = await this.snelStartService.getCompanyInfo();
      return companyInfo;
    } catch (error: any) {
      throw new Error(`Company info alınamadı: ${error.message}`);
    }
  }
}

