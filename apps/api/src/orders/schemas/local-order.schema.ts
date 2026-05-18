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
  manualPriceOverride?: {
    previousUnitPrice: number;
    newUnitPrice: number;
    overrideType: 'full' | 'limited';
    changedByUserId?: string;
    changedByUsername?: string;
    limitPercent?: number;
  };
  isChildItem?: boolean;
  lineType?: 'product' | 'recipe_child';
  parentProductId?: string;
  childSnelstartId?: string;
  childArtikelcode?: string;
  quantityPerParent?: number;
}

export type DeliveryType = 'warehouse_pickup' | 'market_delivery';
export type DeliveryTiming = 'asap' | 'scheduled';

@Schema({ timestamps: true })
export class LocalOrder extends Document {
  @Prop({ required: true, unique: true })
  idempotencyKey: string;

  @Prop({ index: true })
  orderNumber?: string;

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

  @Prop({ enum: ['warehouse_pickup', 'market_delivery'], default: null })
  deliveryType?: DeliveryType | null;

  @Prop({ enum: ['asap', 'scheduled'], default: null })
  deliveryTiming?: DeliveryTiming | null;

  @Prop()
  deliveryDate?: Date;

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

LocalOrderSchema.index({ customerId: 1, createdAt: -1 });
LocalOrderSchema.index({ createdByUserId: 1, createdAt: -1 });
LocalOrderSchema.index({ status: 1, createdAt: -1 });
LocalOrderSchema.index({ deliveryType: 1 });
LocalOrderSchema.index({ deliveryTiming: 1 });
LocalOrderSchema.index({ totalInclVat: -1 });
LocalOrderSchema.index({ orderNumber: 1 });
LocalOrderSchema.index({ 'items.productId': 1 });
LocalOrderSchema.index({ 'items.sku': 1 });
