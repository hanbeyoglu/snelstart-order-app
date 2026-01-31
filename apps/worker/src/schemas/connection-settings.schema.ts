import { Schema, Document, Model } from 'mongoose';

export interface ConnectionSettings extends Document {
  subscriptionKey: string;
  integrationKey: string;
  isActive: boolean;
  lastTestedAt?: Date;
  lastTestStatus?: 'success' | 'failed';
  lastTestError?: string;
}

export const ConnectionSettingsSchema = new Schema<ConnectionSettings>(
  {
    subscriptionKey: { type: String, required: true },
    integrationKey: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    lastTestedAt: Date,
    lastTestStatus: { type: String, enum: ['success', 'failed'] },
    lastTestError: String,
  },
  { timestamps: true },
);

export type ConnectionSettingsModel = Model<ConnectionSettings>;

