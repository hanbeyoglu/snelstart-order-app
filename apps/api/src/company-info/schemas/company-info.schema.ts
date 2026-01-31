import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class CompanyInfo extends Document {
  // Company identifier (unique)
  @Prop({ required: true, unique: true })
  administrationId: string;

  // Company name
  @Prop({ required: true })
  companyName: string;

  // Contact information
  @Prop()
  contactPerson?: string;

  @Prop()
  address?: string;

  @Prop()
  postalCode?: string;

  @Prop()
  city?: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop()
  website?: string;

  // Bank information
  @Prop()
  iban?: string;

  @Prop()
  bic?: string;

  // Tax information
  @Prop()
  vatNumber?: string;

  @Prop()
  kvkNumber?: string;

  // Raw data from SnelStart API (for reference)
  @Prop({ type: Object })
  rawData?: Record<string, any>;

  // Last fetched timestamp for cache control
  @Prop()
  lastFetchedAt?: Date;

  // Hash for change detection
  @Prop()
  dataHash?: string;
}

export const CompanyInfoSchema = SchemaFactory.createForClass(CompanyInfo);
export type CompanyInfoDocument = CompanyInfo & Document;
