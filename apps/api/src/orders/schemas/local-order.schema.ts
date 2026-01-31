import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  basePrice: number;
  totalPrice: number;
  vatPercentage: number;
  customUnitPrice?: number; // Manuel olarak düzenlenmiş birim fiyat
}

@Schema({ timestamps: true })
export class LocalOrder extends Document {
  @Prop({ required: true, unique: true })
  idempotencyKey: string;

  @Prop({ required: true })
  customerId: string;

  @Prop({ type: Array, required: true })
  items: CartItem[];

  @Prop({ required: true })
  subtotal: number;

  @Prop({ required: true })
  total: number;

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

