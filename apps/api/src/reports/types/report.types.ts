/** Report type: orders list or aggregated top products */
export type ReportType = 'orders' | 'top-products';

/** Alış fiyatı filtresi (top-products için) */
export type PurchasePriceFilter = 'all' | 'with-price' | 'without-price';

/** Query params for GET /api/reports/orders */
export interface ReportOrdersQuery {
  type: ReportType;
  tenantId?: string;
  siteId?: string;
  startDate?: string;
  endDate?: string;
  skip?: number;
  top?: number;
  purchasePriceFilter?: PurchasePriceFilter;
}

/** Single order in reports (from SnelStart verkooporders) */
export interface ReportOrder {
  id: string;
  orderNo?: string;
  customerId: string;
  customerName: string;
  date: string;
  total: number;
  procesStatus?: string;
}

/** Order line from SnelStart (regels item) */
export interface VerkooporderRegel {
  artikel?: { id?: string; uri?: string };
  artikelId?: string;
  aantal: number;
  stuksprijs: number;
  inkoopprijs?: number;
  omschrijving?: string;
}

/** Raw SnelStart verkooporder */
export interface Verkooporder {
  id: string;
  ordernummer?: string;
  relatie?: { id: string; naam?: string };
  datum: string;
  regels?: VerkooporderRegel[];
  procesStatus?: string;
}

/** Paginated report response */
export interface ReportResult<T> {
  items: T[];
  totalCount: number;
}

/** Aggregated product for top-products report */
export interface ReportTopProduct {
  productId: string;
  productName: string;
  totalQuantity: number;
  salesPrice: number;
  purchasePrice: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}
