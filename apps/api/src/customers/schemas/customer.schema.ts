import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Customer extends Document {
  // SnelStart unique identifier
  @Prop({ required: true, unique: true })
  snelstartId: string;

  // Customer code from SnelStart
  @Prop({ required: true })
  relatiecode: number;

  // Customer name
  @Prop({ required: true })
  naam: string;

  // Contact information
  @Prop()
  email?: string;

  @Prop()
  telefoon?: string;

  // Address information (nested object)
  @Prop({
    type: {
      straat: String,
      postcode: String,
      plaats: String,
      landId: String,
    },
  })
  adres?: {
    straat?: string;
    postcode?: string;
    plaats?: string;
    landId?: string;
  };

  // Tax and business information
  @Prop()
  kvkNummer?: string;

  @Prop()
  btwNummer?: string;

  // Status
  @Prop({ default: false })
  nonactief: boolean;

  // SnelStart metadata
  @Prop()
  modifiedOn?: Date;

  // Additional fields from SnelStart (flexible storage)
  @Prop({ type: Object })
  extraVelden?: Record<string, any>;

  // Sync tracking
  @Prop()
  lastSyncedAt?: Date;

  // Hash for change detection
  @Prop()
  hash?: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
export type CustomerDocument = Customer & Document;
