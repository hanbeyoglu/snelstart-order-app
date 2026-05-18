import { Schema, Document } from 'mongoose';

export interface MailSettings extends Document {
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  smtpPasswordEncrypted?: string;
  smtpFromName?: string;
  smtpFromEmail?: string;
  orderNotificationToEmails: string[];
  orderNotificationCcEmails: string[];
  orderNotificationLocale?: string;
  isActive: boolean;
}

export const MailSettingsSchema = new Schema<MailSettings>(
  {
    smtpHost: String,
    smtpPort: Number,
    smtpSecure: { type: Boolean, default: false },
    smtpUsername: String,
    smtpPasswordEncrypted: String,
    smtpFromName: String,
    smtpFromEmail: String,
    orderNotificationToEmails: { type: [String], default: [] },
    orderNotificationCcEmails: { type: [String], default: [] },
    orderNotificationLocale: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
