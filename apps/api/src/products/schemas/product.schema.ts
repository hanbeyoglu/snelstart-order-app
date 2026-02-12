import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Product extends Document {
  @Prop({ required: true, unique: true })
  snelstartId: string; // artikel ID

  @Prop()
  artikelnummer?: string; // SKU (optional - may fallback to artikelcode)

  @Prop()
  artikelcode?: string; // Article code (alternative identifier)

  @Prop({ required: true })
  omschrijving: string; // Name

  @Prop()
  artikelgroepId?: string; // Category/Group ID (optional - may be missing from API)

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

  @Prop()
  imageUrl?: string; // Cover image URL from R2

  @Prop({ default: Date.now })
  lastSyncedAt: Date;

  @Prop()
  modifiedOn?: Date; // Last modification timestamp from SnelStart (for delta sync)

  @Prop({ default: true })
  isActive?: boolean; // Mark inactive if product no longer exists in SnelStart
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Create indexes for optimized search
// NOTE: snelstartId already has unique: true in @Prop decorator above
ProductSchema.index({ snelstartId: 1 }, { unique: true }); // Primary unique identifier (enforced)
ProductSchema.index({ artikelcode: 1 }); // For lookups (NOT unique - may be empty or duplicate)
ProductSchema.index({ artikelnummer: 1 }); // For SKU searches
ProductSchema.index({ omschrijving: 'text' }); // Text search index
ProductSchema.index({ barcode: 1 }); // Barcode searches
ProductSchema.index({ artikelgroepId: 1 }); // Category filtering
ProductSchema.index({ artikelomzetgroepId: 1 }); // Category filtering
ProductSchema.index({ isActive: 1 }); // Active products filter
ProductSchema.index({ lastSyncedAt: -1 }); // Sync tracking
ProductSchema.index({ modifiedOn: -1 }); // Delta sync tracking

export type ProductDocument = Product & Document;
