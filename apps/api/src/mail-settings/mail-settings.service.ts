import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { MailSettings, MailSettingsDocument } from './schemas/mail-settings.schema';
import { EncryptionService } from '../connection-settings/encryption.service';
import {
  normalizeOrderNotificationLocale,
  type OrderNotificationEmailLocale,
} from '@snelstart-order-app/shared';

export interface ResolvedMailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpFromName?: string;
  smtpFromEmail?: string;
  orderNotificationToEmails: string[];
  orderNotificationCcEmails: string[];
  orderNotificationLocale: OrderNotificationEmailLocale;
}

export interface MailMessage {
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
}

// ── Sanitization helpers ─────────────────────────────────────────────────────

/** Strip display-name wrapper and return a lowercase plain email. */
function cleanEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

/** Validate and clean an array of email strings. Drops empty/invalid entries. */
function cleanEmailList(raw: string[]): string[] {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return raw.map(cleanEmail).filter((e) => e && EMAIL_RE.test(e));
}

/** Build a safe From header:  "Display Name" <email>  or just  email. */
function buildFrom(rawEmail: string, rawName?: string): string {
  const email = cleanEmail(rawEmail);
  if (!rawName || !rawName.trim()) return email;
  const name = rawName.trim().replace(/["<>]/g, '');
  return `"${name}" <${email}>`;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MailSettingsService {
  private readonly logger = new Logger(MailSettingsService.name);

  constructor(
    @InjectModel(MailSettings.name) private model: Model<MailSettingsDocument>,
    private encryption: EncryptionService,
  ) {}

  private resolveOrderNotificationLocale(doc?: { orderNotificationLocale?: string | null } | null): OrderNotificationEmailLocale {
    return normalizeOrderNotificationLocale(
      doc?.orderNotificationLocale ?? process.env.ORDER_NOTIFICATION_LOCALE,
    );
  }

  // ── Settings resolution ───────────────────────────────────────────────────

  async getActiveSettings(): Promise<ResolvedMailConfig | null> {
    const doc = await this.model.findOne({ isActive: true }).exec();

    const envToEmails = (process.env.ORDER_NOTIFICATION_EMAILS || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (doc) {
      const smtpHost = doc.smtpHost || process.env.SMTP_HOST;
      if (!smtpHost) return null;

      let smtpPassword: string | undefined;
      if (doc.smtpPasswordEncrypted) {
        try {
          smtpPassword = this.encryption.decrypt(doc.smtpPasswordEncrypted);
        } catch {
          smtpPassword = process.env.SMTP_PASS;
        }
      } else {
        smtpPassword = process.env.SMTP_PASS;
      }

      return {
        smtpHost,
        smtpPort: doc.smtpPort ?? Number(process.env.SMTP_PORT || 587),
        smtpSecure: doc.smtpSecure ?? false,
        smtpUsername: doc.smtpUsername || process.env.SMTP_USER,
        smtpPassword,
        smtpFromName: doc.smtpFromName,
        smtpFromEmail: doc.smtpFromEmail || process.env.SMTP_FROM,
        orderNotificationToEmails:
          doc.orderNotificationToEmails.length > 0 ? doc.orderNotificationToEmails : envToEmails,
        orderNotificationCcEmails: doc.orderNotificationCcEmails,
        orderNotificationLocale: this.resolveOrderNotificationLocale(doc),
      };
    }

    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost) return null;

    return {
      smtpHost,
      smtpPort: Number(process.env.SMTP_PORT || 587),
      smtpSecure: false,
      smtpUsername: process.env.SMTP_USER,
      smtpPassword: process.env.SMTP_PASS,
      smtpFromEmail: process.env.SMTP_FROM,
      orderNotificationToEmails: envToEmails,
      orderNotificationCcEmails: [],
      orderNotificationLocale: this.resolveOrderNotificationLocale(null),
    };
  }

  async getPublicSettings() {
    const doc = await this.model.findOne({ isActive: true }).exec();

    if (!doc) {
      const envToEmails = (process.env.ORDER_NOTIFICATION_EMAILS || '')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      return {
        smtpHost: process.env.SMTP_HOST || '',
        smtpPort: Number(process.env.SMTP_PORT || 587),
        smtpSecure: false,
        smtpUsername: process.env.SMTP_USER || '',
        passwordConfigured: !!process.env.SMTP_PASS,
        smtpFromName: '',
        smtpFromEmail: process.env.SMTP_FROM || '',
        orderNotificationToEmails: envToEmails,
        orderNotificationCcEmails: [] as string[],
        orderNotificationLocale: this.resolveOrderNotificationLocale(null),
      };
    }

    return {
      smtpHost: doc.smtpHost || '',
      smtpPort: doc.smtpPort ?? 587,
      smtpSecure: doc.smtpSecure,
      smtpUsername: doc.smtpUsername || '',
      passwordConfigured: !!doc.smtpPasswordEncrypted,
      smtpFromName: doc.smtpFromName || '',
      smtpFromEmail: doc.smtpFromEmail || '',
      orderNotificationToEmails: doc.orderNotificationToEmails,
      orderNotificationCcEmails: doc.orderNotificationCcEmails,
      orderNotificationLocale: this.resolveOrderNotificationLocale(doc),
    };
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  async saveSmtpSettings(data: {
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUsername?: string;
    smtpPassword?: string;
    smtpFromName?: string;
    smtpFromEmail?: string;
  }): Promise<void> {
    let doc = await this.model.findOne({ isActive: true }).exec();
    if (!doc) doc = new this.model({ isActive: true });

    if (data.smtpHost !== undefined) doc.smtpHost = data.smtpHost;
    if (data.smtpPort !== undefined) doc.smtpPort = data.smtpPort;
    if (data.smtpSecure !== undefined) doc.smtpSecure = data.smtpSecure;
    if (data.smtpUsername !== undefined) doc.smtpUsername = data.smtpUsername;
    if (data.smtpPassword) {
      doc.smtpPasswordEncrypted = this.encryption.encrypt(data.smtpPassword);
    }
    if (data.smtpFromName !== undefined) doc.smtpFromName = data.smtpFromName;
    if (data.smtpFromEmail !== undefined) doc.smtpFromEmail = data.smtpFromEmail;

    await doc.save();
  }

  async saveNotificationSettings(data: {
    orderNotificationToEmails: string[];
    orderNotificationCcEmails: string[];
    orderNotificationLocale: OrderNotificationEmailLocale;
  }): Promise<void> {
    let doc = await this.model.findOne({ isActive: true }).exec();
    if (!doc) doc = new this.model({ isActive: true });

    doc.orderNotificationToEmails = data.orderNotificationToEmails;
    doc.orderNotificationCcEmails = data.orderNotificationCcEmails;
    doc.orderNotificationLocale = data.orderNotificationLocale;

    await doc.save();
  }

  // ── Mail transport (nodemailer) ───────────────────────────────────────────

  async sendMail(
    config: Pick<
      ResolvedMailConfig,
      'smtpHost' | 'smtpPort' | 'smtpSecure' | 'smtpUsername' | 'smtpPassword' | 'smtpFromName' | 'smtpFromEmail'
    >,
    message: MailMessage,
  ): Promise<void> {
    // Sanitize credentials
    const user = config.smtpUsername?.trim().toLowerCase() || undefined;
    const pass = config.smtpPassword?.replace(/\s+/g, '') || undefined;

    // Build From address
    const rawFromEmail = config.smtpFromEmail || user || 'orders@app.local';
    const from = buildFrom(rawFromEmail, config.smtpFromName);

    // Sanitize recipient lists — plain emails only, no display names
    const to = cleanEmailList(message.to);
    const cc = message.cc ? cleanEmailList(message.cc) : [];

    if (to.length === 0) throw new Error('No valid recipient email addresses');

    // Debug log — never include password
    this.logger.debug(
      `sendMail ${JSON.stringify({ from, to, cc, host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure, auth: !!user })}`,
    );

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort ?? 587,
      secure: config.smtpSecure ?? false,
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({
      from,
      to,
      cc: cc.length ? cc : undefined,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  // ── Test email ────────────────────────────────────────────────────────────

  async sendTestEmail(
    to: string,
    smtpOverride?: Partial<ResolvedMailConfig>,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = await this.getActiveSettings();

      const resolved = {
        smtpHost: smtpOverride?.smtpHost || settings?.smtpHost || '',
        smtpPort: smtpOverride?.smtpPort ?? settings?.smtpPort ?? 587,
        smtpSecure: smtpOverride?.smtpSecure ?? settings?.smtpSecure ?? false,
        smtpUsername: smtpOverride?.smtpUsername ?? settings?.smtpUsername,
        smtpPassword: smtpOverride?.smtpPassword ?? settings?.smtpPassword,
        smtpFromName: smtpOverride?.smtpFromName ?? settings?.smtpFromName,
        smtpFromEmail: smtpOverride?.smtpFromEmail ?? settings?.smtpFromEmail,
      };

      if (!resolved.smtpHost) {
        return { success: false, error: 'SMTP host is not configured' };
      }

      // Fall back to SMTP username when to address not supplied
      const recipient = cleanEmail(to) || cleanEmail(resolved.smtpUsername || '');
      if (!recipient) {
        return { success: false, error: 'No recipient email address available' };
      }

      await this.sendMail(resolved, {
        to: [recipient],
        subject: 'Test E-Mail — Mail Settings',
        text: [
          'This is a test email to verify your SMTP configuration.',
          '',
          `Sent at : ${new Date().toISOString()}`,
          `SMTP    : ${resolved.smtpHost}:${resolved.smtpPort} (secure=${resolved.smtpSecure})`,
          `From    : ${resolved.smtpFromEmail || resolved.smtpUsername || '(default)'}`,
        ].join('\n'),
        html: [
          '<p>This is a test email to verify your SMTP configuration.</p>',
          `<p><b>Sent at:</b> ${new Date().toISOString()}</p>`,
          `<p><b>SMTP:</b> ${resolved.smtpHost}:${resolved.smtpPort} (secure=${resolved.smtpSecure})</p>`,
          `<p><b>From:</b> ${resolved.smtpFromEmail || resolved.smtpUsername || '(default)'}</p>`,
        ].join(''),
      });

      return { success: true };
    } catch (error: any) {
      this.logger.error(`Test email failed: ${error?.message || error}`);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }
}
