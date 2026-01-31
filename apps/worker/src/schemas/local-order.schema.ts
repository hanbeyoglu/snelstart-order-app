import { Schema, Document, Model } from 'mongoose';

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

export interface LocalOrder extends Document {
  idempotencyKey: string;
  customerId: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  status: 'DRAFT' | 'PENDING_SYNC' | 'SYNCED' | 'FAILED';
  snelstartOrderId?: string;
  errorMessage?: string;
  retryCount: number;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const LocalOrderSchema = new Schema<LocalOrder>(
  {
    idempotencyKey: { type: String, required: true, unique: true },
    customerId: { type: String, required: true },
    items: { type: [Schema.Types.Mixed], required: true } as any,
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_SYNC', 'SYNCED', 'FAILED'],
      default: 'DRAFT',
    },
    snelstartOrderId: String,
    errorMessage: String,
    retryCount: { type: Number, default: 0 },
    syncedAt: Date,
  },
  { timestamps: true },
);

export type LocalOrderModel = Model<LocalOrder>;

