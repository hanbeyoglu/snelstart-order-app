import { z } from 'zod';
import { normalizeOrderNotificationLocale } from '../i18n/order-notification-email';
import { ORDER_NOTE_MAX_LENGTH, sanitizeOrderNote } from '../order-note';

// SnelStart API Validators
export const snelStartProductSchema = z.object({
  id: z.string(),
  artikelnummer: z.string(),
  omschrijving: z.string(),
  artikelgroepId: z.string(),
  artikelgroepOmschrijving: z.string().optional(),
  voorraad: z.number().optional(),
  verkoopprijs: z.number().optional(),
  btwPercentage: z.number().optional(),
  eenheid: z.string().optional(),
  barcode: z.string().optional(),
});

export const snelStartProductGroupSchema = z.object({
  id: z.string(),
  omschrijving: z.string(),
  parentId: z.string().optional(),
  niveau: z.number().optional(),
});

export const snelStartCustomerSchema = z.object({
  id: z.string(),
  relatiecode: z.string().optional(),
  naam: z.string(),
  adres: z.string().optional(),
  postcode: z.string().optional(),
  plaats: z.string().optional(),
  land: z.string().optional(),
  telefoon: z.string().optional(),
  email: z.string().email().optional(),
});

export * from './customer-validation';

export const cartItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  sku: z.string(),
  categoryId: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  unitPriceExclVat: z.number().nonnegative().optional(),
  basePrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
  vatPercentage: z.number().nonnegative(),
  vatType: z.string().nullable().optional(),
  vatRate: z.number().nonnegative().optional(),
  vatGroupId: z.string().optional(),
  vatGroupName: z.string().optional(),
  subtotalExclVat: z.number().nonnegative().optional(),
  vatAmount: z.number().nonnegative().optional(),
  lineSubtotalExclVat: z.number().nonnegative().optional(),
  lineVatAmount: z.number().nonnegative().optional(),
  lineTotalInclVat: z.number().nonnegative().optional(),
  totalInclVat: z.number().nonnegative().optional(),
  customUnitPrice: z.number().nonnegative().optional(),
  adminOverride: z.boolean().optional(),
  adminPriceOverrideConfirmed: z.boolean().optional(),
  adminOverrideReason: z.string().optional(),
  isChildItem: z.boolean().optional(),
  lineType: z.enum(['product', 'recipe_child']).optional(),
  parentProductId: z.string().optional(),
});

const optionalOrderNoteSchema = z
  .union([z.string(), z.undefined(), z.null()])
  .optional()
  .transform((value) => sanitizeOrderNote(value == null ? undefined : String(value)));

const optionalOrderLocaleSchema = z
  .union([z.string(), z.undefined(), z.null()])
  .optional()
  .transform((value) => {
    if (value == null || String(value).trim() === '') return undefined;
    return normalizeOrderNotificationLocale(String(value));
  });

export const createOrderSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    customerId: z.string(),
    items: z.array(cartItemSchema),
    note: optionalOrderNoteSchema,
    deliveryType: z.enum(['warehouse_pickup', 'market_delivery']).optional(),
    deliveryTiming: z.enum(['asap', 'scheduled']).optional(),
    deliveryDate: z
      .union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
      .optional(),
    locale: optionalOrderLocaleSchema,
    language: optionalOrderLocaleSchema,
  })
  .transform((data) => {
    const locale = data.locale ?? data.language;
    const { language: _language, ...rest } = data;
    return { ...rest, locale };
  });

export const createOrderRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  customerId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().positive(),
    }),
  ).min(1),
});

export const priceOverrideRuleSchema = z.object({
  type: z.enum([
    'PRODUCT_CUSTOMER_FIXED',
    'PRODUCT_CUSTOMER_PERCENT',
    'CATEGORY_CUSTOMER_PERCENT',
    'GLOBAL_PRODUCT_FIXED',
    'GLOBAL_PRODUCT_PERCENT',
    'GLOBAL_CATEGORY_PERCENT',
  ]),
  productId: z.string().optional(),
  categoryId: z.string().optional(),
  customerId: z.string().optional(),
  fixedPrice: z.number().positive().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  priority: z.number().int().positive(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
});

export const snelStartConnectionTestSchema = z.object({
  subscriptionKey: z.string().min(1),
  integrationKey: z.string().min(1),
});

export const uploadImageSchema = z.object({
  productId: z.string(),
  isCover: z.boolean().default(false),
});
