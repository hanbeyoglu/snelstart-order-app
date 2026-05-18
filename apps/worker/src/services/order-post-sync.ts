import mongoose from 'mongoose';
import axios from 'axios';
import nodemailer from 'nodemailer';
import {
  buildOrderNotificationHtml,
  buildOrderNotificationSubject,
  buildOrderNotificationText,
  buildSnelStartApiHeaders,
  normalizeOrderNotificationLocale,
  resolveSnelStartUrls,
  type OrderNotificationEmailLocale,
} from '@snelstart-order-app/shared';
import { AuditLogSchema } from '../schemas/audit-log.schema';
import { MailSettingsSchema } from '../schemas/mail-settings.schema';
import { EncryptionService } from './encryption.service';

const { baseUrl: SNELSTART_BASE_URL } = resolveSnelStartUrls();

interface MailConfig {
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

function cleanEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

function cleanEmailList(raw: string[]): string[] {
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return raw.map(cleanEmail).filter((e) => e && emailRe.test(e));
}

function buildFrom(rawEmail: string, rawName?: string): string {
  const email = cleanEmail(rawEmail);
  if (!rawName?.trim()) return email;
  const name = rawName.trim().replace(/["<>]/g, '');
  return `"${name}" <${email}>`;
}

async function writeAudit(
  action: string,
  entityId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const AuditModel = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
  await AuditModel.create({
    action,
    entityType: 'LocalOrder',
    entityId,
    metadata,
  });
}

async function getActiveMailConfig(): Promise<MailConfig | null> {
  const MailModel = mongoose.models.MailSettings || mongoose.model('MailSettings', MailSettingsSchema);
  const doc = await MailModel.findOne({ isActive: true }).exec();
  const encryption = new EncryptionService();

  const envToEmails = (process.env.ORDER_NOTIFICATION_EMAILS || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  const resolveLocale = (locale?: string | null) =>
    normalizeOrderNotificationLocale(locale ?? process.env.ORDER_NOTIFICATION_LOCALE);

  if (doc) {
    const smtpHost = doc.smtpHost || process.env.SMTP_HOST;
    if (!smtpHost) return null;

    let smtpPassword: string | undefined;
    if (doc.smtpPasswordEncrypted) {
      try {
        smtpPassword = encryption.decrypt(doc.smtpPasswordEncrypted);
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
      orderNotificationCcEmails: doc.orderNotificationCcEmails ?? [],
      orderNotificationLocale: resolveLocale(doc.orderNotificationLocale),
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
    smtpFromName: undefined,
    smtpFromEmail: process.env.SMTP_FROM,
    orderNotificationToEmails: envToEmails,
    orderNotificationCcEmails: [],
    orderNotificationLocale: resolveLocale(null),
  };
}

async function sendMail(
  config: Pick<
    MailConfig,
    'smtpHost' | 'smtpPort' | 'smtpSecure' | 'smtpUsername' | 'smtpPassword' | 'smtpFromName' | 'smtpFromEmail'
  >,
  message: { to: string[]; cc?: string[]; subject: string; text: string; html?: string },
): Promise<void> {
  const user = config.smtpUsername?.trim().toLowerCase() || undefined;
  const pass = config.smtpPassword?.replace(/\s+/g, '') || undefined;
  const rawFromEmail = config.smtpFromEmail || user || 'orders@app.local';
  const from = buildFrom(rawFromEmail, config.smtpFromName);
  const to = cleanEmailList(message.to);
  const cc = message.cc ? cleanEmailList(message.cc) : [];

  if (to.length === 0) throw new Error('No valid recipient email addresses');

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

async function sendOrderNotification(order: any, customer?: any): Promise<boolean> {
  const settings = await getActiveMailConfig();
  if (!settings || settings.orderNotificationToEmails.length === 0) {
    return false;
  }

  const locale = settings.orderNotificationLocale;
  const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';

  await sendMail(settings, {
    to: settings.orderNotificationToEmails,
    cc: settings.orderNotificationCcEmails.length > 0 ? settings.orderNotificationCcEmails : undefined,
    subject: buildOrderNotificationSubject(order, customer, locale),
    text: buildOrderNotificationText(order, locale, undefined, customer, appUrl),
    html: buildOrderNotificationHtml(order, locale, undefined, customer, appUrl),
  });

  return true;
}

export async function fetchSnelStartCustomer(
  customerId: string,
  subscriptionKey: string,
  accessToken: string,
): Promise<any | undefined> {
  try {
    const response = await axios.get(`${SNELSTART_BASE_URL}/v2/relaties/${customerId}`, {
      headers: buildSnelStartApiHeaders(subscriptionKey, accessToken),
      timeout: 30000,
    });
    return response.data;
  } catch {
    return undefined;
  }
}

export async function handleOrderSyncSuccess(
  order: any,
  subscriptionKey: string,
  accessToken: string,
): Promise<void> {
  const orderId = order._id.toString();

  await writeAudit('ORDER_SYNCED', orderId, {
    snelstartOrderId: order.snelstartOrderId,
    trigger: 'worker',
  });

  const customer = await fetchSnelStartCustomer(order.customerId, subscriptionKey, accessToken);

  let emailSent = false;
  try {
    emailSent = await sendOrderNotification(order, customer);
  } catch (error: any) {
    console.error(`Order notification email failed for ${orderId}:`, error?.message || error);
  }

  await writeAudit(
    emailSent ? 'ORDER_NOTIFICATION_EMAIL_SENT' : 'ORDER_NOTIFICATION_EMAIL_FAILED',
    orderId,
    { customerId: order.customerId, trigger: 'worker_sync_success' },
  );
}

export async function handleOrderSyncFinalFailure(order: any, errorMessage: string): Promise<void> {
  await writeAudit('ORDER_SYNC_FAILED', order._id.toString(), {
    error: errorMessage,
    trigger: 'worker_exhausted',
  });
}
