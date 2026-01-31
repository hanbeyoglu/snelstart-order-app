// SnelStart API Types
export interface SnelStartPrijsafspraak {
  relatie?: {
    id: string;
    uri?: string;
  } | null;
  artikel?: {
    id: string;
    uri?: string;
  };
  datum?: string; // ISO date
  aantal?: number;
  korting?: number;
  verkoopprijs?: number;
  basisprijs?: number;
  datumVanaf?: string | null; // ISO date
  datumTotEnMet?: string | null; // ISO date
  prijsBepalingSoort?: string;
}

export interface SnelStartProduct {
  id: string;
  artikelnummer?: string; // SKU
  artikelcode?: string; // Article code
  omschrijving: string; // Name
  artikelgroepId?: string;
  artikelgroepOmschrijving?: string;
  artikelOmzetgroep?: {
    id: string;
    uri?: string;
    omschrijving?: string;
  };
  artikelomzetgroepId?: string; // Artikel Omzet Groep ID (for category matching) - extracted from artikelOmzetgroep.id
  artikelomzetgroepOmschrijving?: string;
  voorraad?: number; // Stock
  verkoopprijs?: number; // Base price
  btwPercentage?: number; // VAT
  eenheid?: string; // Unit
  barcode?: string;
  prijsafspraak?: SnelStartPrijsafspraak;
}

export interface SnelStartProductGroup {
  id: string;
  omschrijving: string; // Description/Name
  parentId?: string;
  niveau?: number;
}

export interface SnelStartArtikelOmzetGroep {
  nummer: number;
  omschrijving: string;
  verkoopGrootboekNederlandIdentifier?: {
    id: string;
    uri: string;
  };
  verkoopNederlandBtwSoort?: string;
  id: string;
  uri: string;
}

export interface SnelStartCustomer {
  id: string;
  relatiecode?: string;
  naam: string; // Name
  adres?: string;
  postcode?: string;
  plaats?: string;
  land?: string;
  telefoon?: string;
  email?: string;
}

export interface SnelStartSalesOrder {
  id?: string;
  relatieId: string; // Customer ID
  orderdatum: string; // ISO date
  regels: SnelStartOrderLine[];
  referentie?: string;
}

export interface SnelStartOrderLine {
  artikelId: string;
  aantal: number; // Quantity
  eenheidsprijs: number; // Unit price
  kortingspercentage?: number;
  btwPercentage?: number;
}

// Local App Types
export interface ProductImage {
  id: string;
  snelstartProductId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  isCover: boolean;
  uploadedAt: Date;
}

export interface ProductImageMapping {
  _id?: string;
  snelstartProductId: string;
  images: ProductImage[];
  coverImageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PriceOverrideRuleType =
  | 'PRODUCT_CUSTOMER_FIXED'
  | 'PRODUCT_CUSTOMER_PERCENT'
  | 'CATEGORY_CUSTOMER_PERCENT'
  | 'GLOBAL_PRODUCT_FIXED'
  | 'GLOBAL_PRODUCT_PERCENT'
  | 'GLOBAL_CATEGORY_PERCENT';

export interface PriceOverrideRule {
  _id?: string;
  type: PriceOverrideRuleType;
  productId?: string;
  categoryId?: string;
  customerId?: string;
  fixedPrice?: number;
  discountPercent?: number;
  priority: number; // Higher = applied first
  validFrom: Date;
  validTo?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalOrder {
  _id?: string;
  idempotencyKey: string; // Client-generated UUID
  customerId: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  status: OrderStatus;
  snelstartOrderId?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  syncedAt?: Date;
}

export type OrderStatus = 'DRAFT' | 'PENDING_SYNC' | 'SYNCED' | 'FAILED';

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
  inkoopprijs?: number; // Alış fiyatı (minimum fiyat kontrolü için)
  eenheid?: string; // Ürün birimi (kg, st, m, vb.)
}

export interface User {
  _id?: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'sales_rep';
  createdAt: Date;
  updatedAt: Date;
}

export interface SnelStartConnectionSettings {
  _id?: string;
  subscriptionKey: string; // Encrypted
  integrationKey: string; // Encrypted
  isActive: boolean;
  lastTestedAt?: Date;
  lastTestStatus?: 'success' | 'failed';
  lastTestError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  _id?: string;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
}
