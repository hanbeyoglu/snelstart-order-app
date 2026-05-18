import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConnectionSettingsService } from './connection-settings.service';
import { SnelStartService } from '../snelstart/snelstart.service';
import { CompanyInfoService } from '../company-info/company-info.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { snelStartConnectionTestSchema } from '@snelstart-order-app/shared';
import { parseOrBadRequest } from '../common/validation/zod-validation';
import { AuditService } from '../audit/audit.service';

@ApiTags('Connection Settings')
@Controller('connection-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ConnectionSettingsController {
  constructor(
    private connectionSettingsService: ConnectionSettingsService,
    private snelStartService: SnelStartService,
    private companyInfoService: CompanyInfoService,
    private auditService: AuditService,
  ) {}

  private async getConnectionStatus() {
    const settings = await this.connectionSettingsService.getSettings();
    if (!settings) {
      return {
        exists: false,
        isTokenValid: false,
        isRefreshing: this.connectionSettingsService.isRefreshInProgress(),
      };
    }

    const wasRefreshing = this.connectionSettingsService.isRefreshInProgress();
    await this.connectionSettingsService.getValidAccessToken();
    const updatedSettings = await this.connectionSettingsService.getSettings();
    const isTokenValid = !!(
      updatedSettings?.accessToken &&
      updatedSettings.tokenExpiresAt &&
      updatedSettings.tokenExpiresAt > new Date()
    );

    return {
      exists: true,
      isActive: settings.isActive,
      lastTestedAt: settings.lastTestedAt,
      lastTestStatus: settings.lastTestStatus,
      lastTestError: settings.lastTestError,
      isTokenValid,
      isRefreshing: wasRefreshing || this.connectionSettingsService.isRefreshInProgress(),
      tokenExpiresAt: updatedSettings?.tokenExpiresAt ?? settings.tokenExpiresAt,
    };
  }

  @Get()
  @Roles('admin', 'sales_rep')
  @ApiOperation({ summary: 'Get SnelStart connection settings status (available to all authenticated users)' })
  async getSettings() {
    return this.getConnectionStatus();
  }

  @Get('status')
  @Roles('admin', 'sales_rep')
  @ApiOperation({ summary: 'Get readonly SnelStart connection status' })
  async getStatus() {
    return this.getConnectionStatus();
  }

  @Post()
  @Roles('super_admin')
  @ApiOperation({ summary: 'Save SnelStart connection settings' })
  async saveSettings(
    @Body()
    body: {
      subscriptionKey: string;
      integrationKey: string;
    },
    @Request() req: any,
  ) {
    const validated = parseOrBadRequest(snelStartConnectionTestSchema, body);
    await this.connectionSettingsService.saveSettings(
      validated.subscriptionKey,
      validated.integrationKey,
    );
    await this.auditService.log({
      action: 'SNELSTART_SETTINGS_SAVED',
      entityType: 'ConnectionSettings',
      entityId: 'active',
      userId: req.user.userId,
      actorRole: req.user.role,
      ...this.auditService.requestContext(req),
      changes: validated,
    });
    return { success: true };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Test SnelStart connection' })
  async testConnection(
    @Body()
    body: {
      subscriptionKey: string;
      integrationKey: string;
    },
    @Request() req: any,
  ) {
    const validated = parseOrBadRequest(snelStartConnectionTestSchema, body);
    try {
      const success = await this.snelStartService.testConnection(
        validated.subscriptionKey,
        validated.integrationKey,
      );
      await this.connectionSettingsService.updateTestStatus(success);
      await this.auditService.log({
        action: 'SNELSTART_CONNECTION_TESTED',
        entityType: 'ConnectionSettings',
        entityId: 'active',
        userId: req.user.userId,
        actorRole: req.user.role,
        ...this.auditService.requestContext(req),
        metadata: { success },
      });

      if (success) {
        try {
          await this.companyInfoService.getCompanyInfo();
        } catch (error) {
          console.error('Failed to fetch company info after connection test:', error);
        }
      }

      return { success };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      await this.connectionSettingsService.updateTestStatus(false, errorMessage);
      await this.auditService.log({
        action: 'SNELSTART_CONNECTION_TEST_FAILED',
        entityType: 'ConnectionSettings',
        entityId: 'active',
        userId: req.user.userId,
        actorRole: req.user.role,
        ...this.auditService.requestContext(req),
        metadata: { success: false },
      });
      return { success: false, error: 'Connection test failed' };
    }
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Refresh SnelStart access token (admin only)' })
  async refreshToken(@Request() req: any) {
    const refreshResult = await this.connectionSettingsService.refreshAccessToken();

    if (!refreshResult.success) {
      return { success: false, error: refreshResult.error ?? 'Token refresh failed' };
    }

    try {
      await this.companyInfoService.getCompanyInfo();
    } catch (error) {
      console.error('Failed to fetch company info after token refresh:', error);
    }

    const isTokenValid = await this.connectionSettingsService.isTokenValid();
    const updatedSettings = await this.connectionSettingsService.getSettings();
    await this.auditService.log({
      action: 'SNELSTART_TOKEN_REFRESHED',
      entityType: 'ConnectionSettings',
      entityId: 'active',
      userId: req.user.userId,
      actorRole: req.user.role,
      ...this.auditService.requestContext(req),
      metadata: { tokenExpiresAt: updatedSettings?.tokenExpiresAt },
    });

    return {
      success: true,
      isTokenValid,
      tokenExpiresAt: updatedSettings?.tokenExpiresAt,
    };
  }

  @Get('company-info')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Get company information from SnelStart' })
  async getCompanyInfo() {
    try {
      const companyInfo = await this.snelStartService.getCompanyInfo();
      return companyInfo;
    } catch (error: any) {
      throw new Error('Company info alınamadı');
    }
  }
}
