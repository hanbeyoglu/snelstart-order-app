import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ConnectionSettings extends Document {
  @Prop({ required: true })
  subscriptionKey: string; // Encrypted

  @Prop({ required: true })
  integrationKey: string; // Encrypted

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastTestedAt?: Date;

  @Prop({ enum: ['success', 'failed'] })
  lastTestStatus?: 'success' | 'failed';

  @Prop()
  lastTestError?: string;

  @Prop()
  accessToken?: string; // Encrypted access token from SnelStart

  @Prop()
  tokenExpiresAt?: Date; // Token expiration time (usually 1 hour)
}

export const ConnectionSettingsSchema = SchemaFactory.createForClass(ConnectionSettings);
export type ConnectionSettingsDocument = ConnectionSettings & Document;

