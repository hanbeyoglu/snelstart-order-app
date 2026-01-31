import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Product extends Document {
  @Prop({ required: true, unique: true })
  snelstartId: string; // artikel ID

  @Prop({ required: true })
  artikelnummer: string; // SKU

  @Prop({ required: true })
  omschrijving: string; // Name

  @Prop({ required: true })
  artikelgroepId: string; // Category/Group ID

  @Prop()
  artikelgroepOmschrijving?: string;

  @Prop()
  artikelomzetgroepId?: string; // Artikel Omzet Groep ID (for category matching)

  @Prop()
  artikelomzetgroepOmschrijving?: string;

  @Prop()
  voorraad?: number; // Stock

  @Prop()
  verkoopprijs?: number; // Base price

  @Prop()
  inkoopprijs?: number; // Purchase price

  @Prop()
  btwPercentage?: number; // VAT

  @Prop()
  eenheid?: string; // Unit

  @Prop()
  barcode?: string;

  @Prop({ default: Date.now })
  lastSyncedAt: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
export type ProductDocument = Product & Document;
