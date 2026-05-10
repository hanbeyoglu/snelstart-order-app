import { z } from 'zod';

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

export const createCustomerSchema = z.object({
  relatiesoort: z.array(z.string()).min(1, 'En az bir ilişki türü seçmelisiniz'),
  naam: z.string().min(1, 'Müşteri adı zorunludur'),
  vestigingsAdres: z.object({
    straat: z.string().min(1, 'Sokak adresi zorunludur'),
    postcode: z.string().min(1, 'Posta kodu zorunludur'),
    plaats: z.string().min(1, 'Şehir zorunludur'),
    land: z.object({
      id: z.string(),
    }),
  }),
  telefoon: z.string().optional(),
  email: z.union([
    z.string().email('Geçerli bir e-posta adresi giriniz'),
    z.literal(''),
  ]).optional().transform((val) => val === '' ? undefined : val),
  kvkNummer: z.string().optional(),
  btwNummer: z.string().regex(/^[A-Z]{2}\d{9}[A-Z]{2}$/, 'Geçerli bir BTW numarası giriniz (örn. NL123456789B01)'),
});

// Update için alanlar opsiyonel olabilir, ancak aynı yapıyı koruyoruz
// Update sırasında relatiesoort değiştirilemeyeceği için bu alanı schema'dan çıkarıyoruz
export const updateCustomerSchema = createCustomerSchema.omit({ relatiesoort: true }).partial();

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

export const createOrderSchema = z.object({
  idempotencyKey: z.string().uuid(),
  customerId: z.string(),
  items: z.array(cartItemSchema),
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
