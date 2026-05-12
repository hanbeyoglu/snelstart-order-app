import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MailSettingsService } from './mail-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { AuditService } from '../audit/audit.service';
import { normalizeOrderNotificationLocale } from '@snelstart-order-app/shared';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strip display-name wrapper, lowercase, and validate. Throws on bad input. */
function sanitizeEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

function validateEmails(emails: unknown): string[] {
  if (!Array.isArray(emails)) return [];
  return emails
    .map((e) => sanitizeEmail(String(e)))
    .filter((e) => {
      if (!e) return false;
      if (!EMAIL_RE.test(e)) throw new BadRequestException(`Invalid email address: ${e}`);
      return true;
    });
}

@ApiTags('Mail Settings')
@Controller('mail-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MailSettingsController {
  constructor(
    private mailSettingsService: MailSettingsService,
    private auditService: AuditService,
  ) {}

  @Get()
  @Roles('admin', 'sales_rep')
  @UseGuards(PermissionsGuard)
  @RequirePermission('mail.settings.view')
  @ApiOperation({ summary: 'Get mail settings (masked)' })
  async getSettings() {
    return this.mailSettingsService.getPublicSettings();
  }

  @Post('smtp')
  @Roles('admin')
  @UseGuards(PermissionsGuard)
  @RequirePermission('mail.settings.manage')
  @ApiOperation({ summary: 'Save SMTP connection settings' })
  async saveSmtpSettings(@Body() body: any, @Request() req: any) {
    const { smtpHost, smtpPort, smtpSecure, smtpUsername, smtpPassword, smtpFromName, smtpFromEmail } = body;

    const port = smtpPort !== undefined ? Number(smtpPort) : undefined;
    if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) {
      throw new BadRequestException('SMTP port must be a valid port number (1–65535)');
    }

    // Sanitize: plain email only (no display-name wrappers)
    const cleanUsername = smtpUsername ? sanitizeEmail(String(smtpUsername)) : smtpUsername;
    const cleanFromEmail = smtpFromEmail ? sanitizeEmail(String(smtpFromEmail)) : smtpFromEmail;
    const cleanFromName = smtpFromName ? String(smtpFromName).trim().replace(/["<>]/g, '') : smtpFromName;
    const cleanPassword = smtpPassword ? String(smtpPassword).replace(/\s+/g, '') : smtpPassword;

    if (cleanFromEmail && !EMAIL_RE.test(cleanFromEmail)) {
      throw new BadRequestException('Invalid from email address');
    }
    if (cleanUsername && !EMAIL_RE.test(cleanUsername)) {
      throw new BadRequestException('Invalid SMTP username (must be a plain email address)');
    }

    await this.mailSettingsService.saveSmtpSettings({
      smtpHost: smtpHost ? String(smtpHost).trim() : smtpHost,
      smtpPort: port,
      smtpSecure: smtpSecure === true || smtpSecure === 'true',
      smtpUsername: cleanUsername,
      smtpPassword: cleanPassword,
      smtpFromName: cleanFromName,
      smtpFromEmail: cleanFromEmail,
    });

    await this.auditService.log({
      action: 'MAIL_SETTINGS_SMTP_SAVED',
      entityType: 'MailSettings',
      entityId: 'active',
      userId: req.user.userId,
      actorRole: req.user.role,
      ...this.auditService.requestContext(req),
      changes: {
        smtpHost,
        smtpPort: port,
        smtpSecure,
        smtpUsername: cleanUsername,
        smtpPassword: cleanPassword ? '[REDACTED]' : undefined,
        smtpFromName: cleanFromName,
        smtpFromEmail: cleanFromEmail,
      },
    });

    return { success: true };
  }

  @Post('notifications')
  @Roles('admin')
  @UseGuards(PermissionsGuard)
  @RequirePermission('order.notifications.manage')
  @ApiOperation({ summary: 'Save order notification To/CC emails' })
  async saveNotificationSettings(@Body() body: any, @Request() req: any) {
    const toEmails = validateEmails(body.orderNotificationToEmails);
    const ccEmails = validateEmails(body.orderNotificationCcEmails);
    const orderNotificationLocale = normalizeOrderNotificationLocale(body.orderNotificationLocale);

    await this.mailSettingsService.saveNotificationSettings({
      orderNotificationToEmails: toEmails,
      orderNotificationCcEmails: ccEmails,
      orderNotificationLocale,
    });

    await this.auditService.log({
      action: 'MAIL_SETTINGS_NOTIFICATIONS_SAVED',
      entityType: 'MailSettings',
      entityId: 'active',
      userId: req.user.userId,
      actorRole: req.user.role,
      ...this.auditService.requestContext(req),
      changes: {
        orderNotificationToEmails: toEmails,
        orderNotificationCcEmails: ccEmails,
        orderNotificationLocale,
      },
    });

    return { success: true };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  @UseGuards(PermissionsGuard)
  @RequirePermission('mail.test.send')
  @ApiOperation({ summary: 'Send a test email using current/provided SMTP settings' })
  async sendTestEmail(@Body() body: any, @Request() req: any) {
    const { to, smtpHost, smtpPort, smtpSecure, smtpUsername, smtpPassword, smtpFromName, smtpFromEmail } = body;

    // Build SMTP override from form values
    const override: Record<string, any> = {};
    if (smtpHost) override.smtpHost = String(smtpHost).trim();
    if (smtpPort) override.smtpPort = Number(smtpPort);
    if (smtpSecure !== undefined) override.smtpSecure = smtpSecure === true || smtpSecure === 'true';
    if (smtpUsername) override.smtpUsername = String(smtpUsername).trim().toLowerCase();
    if (smtpPassword) override.smtpPassword = String(smtpPassword).replace(/\s+/g, '');
    if (smtpFromName) override.smtpFromName = String(smtpFromName).trim();
    if (smtpFromEmail) override.smtpFromEmail = String(smtpFromEmail).trim().toLowerCase();

    // Resolve recipient: use provided `to`, fall back to smtpUsername
    const rawTo = to ? sanitizeEmail(String(to)) : '';
    const fallbackTo = override.smtpUsername || sanitizeEmail(String(smtpUsername || ''));
    const recipient = rawTo || fallbackTo;

    if (!recipient || !EMAIL_RE.test(recipient)) {
      throw new BadRequestException(
        'Provide a valid recipient email (to) or configure smtpUsername as fallback',
      );
    }

    const result = await this.mailSettingsService.sendTestEmail(
      recipient,
      Object.keys(override).length > 0 ? override : undefined,
    );

    await this.auditService.log({
      action: result.success ? 'MAIL_TEST_SENT' : 'MAIL_TEST_FAILED',
      entityType: 'MailSettings',
      entityId: 'active',
      userId: req.user.userId,
      actorRole: req.user.role,
      ...this.auditService.requestContext(req),
      metadata: { to: String(to).trim(), success: result.success, error: result.error },
    });

    return result;
  }
}
