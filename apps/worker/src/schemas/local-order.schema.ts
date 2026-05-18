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
  customUnitPrice?: number;
  isChildItem?: boolean;
  lineType?: 'product' | 'recipe_child';
  parentProductId?: string;
  childSnelstartId?: string;
  childArtikelcode?: string;
  quantityPerParent?: number;
}

export interface LocalOrder extends Document {
  idempotencyKey: string;
  orderNumber?: string;
  customerId: string;
  createdByUserId?: string;
  createdByUsername?: string;
  createdByFullName?: string;
  createdByRole?: string;
  createdByCustomerId?: string;
  createdByCustomerName?: string;
  memo?: string;
  note?: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  status: 'DRAFT' | 'PENDING_SYNC' | 'SYNCED' | 'SYNC_FAILED' | 'FAILED';
  deliveryType?: 'warehouse_pickup' | 'market_delivery' | null;
  deliveryTiming?: 'asap' | 'scheduled' | null;
  deliveryDate?: Date;
  snelstartOrderId?: string;
  errorMessage?: string;
  retryCount: number;
  syncedAt?: Date;
  customerConfirmationEmailSentAt?: Date;
  customerConfirmationEmailError?: string;
  customerConfirmationEmailLastAttemptAt?: Date;
  locale?: 'tr' | 'en' | 'nl' | 'de' | 'ar';
  createdAt: Date;
  updatedAt: Date;
}

export const LocalOrderSchema = new Schema<LocalOrder>(
  {
    idempotencyKey: { type: String, required: true, unique: true },
    orderNumber: String,
    customerId: { type: String, required: true },
    createdByUserId: String,
    createdByUsername: String,
    createdByFullName: String,
    createdByRole: String,
    createdByCustomerId: String,
    createdByCustomerName: String,
    memo: String,
    note: String,
    items: { type: [Schema.Types.Mixed], required: true } as any,
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_SYNC', 'SYNCED', 'SYNC_FAILED', 'FAILED'],
      default: 'DRAFT',
    },
    deliveryType: { type: String, enum: ['warehouse_pickup', 'market_delivery', null], default: null },
    deliveryTiming: { type: String, enum: ['asap', 'scheduled', null], default: null },
    deliveryDate: Date,
    snelstartOrderId: String,
    errorMessage: String,
    retryCount: { type: Number, default: 0 },
    syncedAt: Date,
    customerConfirmationEmailSentAt: Date,
    customerConfirmationEmailError: String,
    customerConfirmationEmailLastAttemptAt: Date,
    locale: { type: String, enum: ['tr', 'en', 'nl', 'de', 'ar'] },
  },
  { timestamps: true },
);

export type LocalOrderModel = Model<LocalOrder>;
