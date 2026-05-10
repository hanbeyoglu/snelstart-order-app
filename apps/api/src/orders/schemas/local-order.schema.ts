import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitPriceExclVat?: number;
  basePrice: number;
  totalPrice: number;
  vatPercentage: number;
  vatType?: string | null;
  vatRate?: number;
  vatGroupId?: string;
  vatGroupName?: string;
  subtotalExclVat?: number;
  vatAmount?: number;
  lineSubtotalExclVat?: number;
  lineVatAmount?: number;
  lineTotalInclVat?: number;
  totalInclVat?: number;
  customUnitPrice?: number; // Manuel olarak düzenlenmiş birim fiyat
  adminOverride?: boolean;
  adminPriceOverrideConfirmed?: boolean;
  adminOverrideReason?: string;
  isChildItem?: boolean;
  lineType?: 'product' | 'recipe_child';
  parentProductId?: string;
  childSnelstartId?: string;
  childArtikelcode?: string;
  quantityPerParent?: number;
}

@Schema({ timestamps: true })
export class LocalOrder extends Document {
  @Prop({ required: true, unique: true })
  idempotencyKey: string;

  @Prop({ required: true })
  customerId: string;

  @Prop()
  createdByUserId?: string;

  @Prop()
  createdByUsername?: string;

  @Prop()
  createdByFullName?: string;

  @Prop()
  createdByRole?: string;

  @Prop()
  createdByCustomerId?: string;

  @Prop()
  createdByCustomerName?: string;

  @Prop()
  memo?: string;

  @Prop({ type: Array, required: true })
  items: CartItem[];

  @Prop({ required: true })
  subtotal: number;

  @Prop({ required: true })
  total: number;

  @Prop({ default: 0 })
  subtotalExclVat?: number;

  @Prop({ default: 0 })
  vatAmount?: number;

  @Prop({ default: 0 })
  vatTotal?: number;

  @Prop({ default: 0 })
  totalInclVat?: number;

  @Prop({ type: Array, default: [] })
  vatBreakdown?: Array<{
    vatRate: number;
    subtotalExclVat: number;
    vatAmount: number;
    totalInclVat: number;
  }>;

  @Prop({ required: true, enum: ['DRAFT', 'PENDING_SYNC', 'SYNCED', 'FAILED'], default: 'DRAFT' })
  status: string;

  @Prop()
  snelstartOrderId?: string;

  @Prop()
  errorMessage?: string;

  @Prop({ default: 0 })
  retryCount: number;

  @Prop()
  syncedAt?: Date;
}

export const LocalOrderSchema = SchemaFactory.createForClass(LocalOrder);
export type LocalOrderDocument = LocalOrder & Document;
