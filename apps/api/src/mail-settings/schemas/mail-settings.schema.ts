import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class MailSettings extends Document {
  @Prop()
  smtpHost?: string;

  @Prop({ type: Number })
  smtpPort?: number;

  @Prop({ default: false })
  smtpSecure: boolean;

  @Prop()
  smtpUsername?: string;

  @Prop()
  smtpPasswordEncrypted?: string;

  @Prop()
  smtpFromName?: string;

  @Prop()
  smtpFromEmail?: string;

  @Prop({ type: [String], default: [] })
  orderNotificationToEmails: string[];

  @Prop({ type: [String], default: [] })
  orderNotificationCcEmails: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const MailSettingsSchema = SchemaFactory.createForClass(MailSettings);
export type MailSettingsDocument = MailSettings & Document;
