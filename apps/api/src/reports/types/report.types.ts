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

export type ReportProfitFilter = 'all' | 'profitable' | 'loss' | 'missing-cost';
export type ReportSortDir = 'asc' | 'desc';

export interface AdvancedReportQuery {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  categoryId?: string;
  productId?: string;
  search?: string;
  purchasePriceFilter?: PurchasePriceFilter;
  profitFilter?: ReportProfitFilter;
  sortBy?: string;
  sortDir?: ReportSortDir;
  skip?: number;
  top?: number;
}

export interface ReportKpi {
  totalOrders: number;
  totalRevenue: number;
  totalVat: number;
  netSales: number;
  estimatedProfit: number;
  totalQuantity: number;
  activeCustomerCount: number;
  averageBasket: number;
  missingCostCount: number;
}

export interface AdvancedTopProduct {
  productId: string;
  productName: string;
  artikelcode?: string;
  categoryId?: string;
  categoryName?: string;
  totalQuantity: number;
  soldCases: number;
  netRevenue: number;
  vatAmount: number;
  grossRevenue: number;
  purchasePrice?: number | null;
  salesPrice: number;
  estimatedProfit?: number | null;
  profitMargin?: number | null;
  lastSaleDate?: string;
  customerCount: number;
  returnCount: number;
  missingPurchasePrice: boolean;
}

export interface CustomerAnalyticsItem {
  customerId: string;
  customerName: string;
  orderCount: number;
  totalRevenue: number;
  netSales: number;
  vatAmount: number;
  averageBasket: number;
  topProductName?: string;
  lastOrderDate?: string;
  orderFrequencyDays?: number | null;
  lifetimeValue: number;
  segment: 'active' | 'inactive' | 'valuable';
}

export interface TrendPoint {
  key: string;
  label: string;
  orders: number;
  revenue: number;
  netSales: number;
  vatAmount: number;
  profit: number;
  quantity: number;
}

export interface VatAnalyticsItem {
  vatRate: number;
  vatAmount: number;
  netSales: number;
  grossRevenue: number;
}

export interface AdvancedReportResult {
  kpis: ReportKpi;
  previousKpis: ReportKpi;
  topProducts: AdvancedTopProduct[];
  topProductsTotalCount: number;
  customers: CustomerAnalyticsItem[];
  trends: {
    daily: TrendPoint[];
    weekly: TrendPoint[];
    monthly: TrendPoint[];
    hourly: TrendPoint[];
  };
  vat: {
    totalVat: number;
    byRate: VatAnalyticsItem[];
  };
  profit: {
    totalProfit: number;
    profitMargin: number;
    missingCostCount: number;
    byCategory: Array<{ categoryId: string; categoryName: string; profit: number; netSales: number; margin: number }>;
    byCustomer: Array<{ customerId: string; customerName: string; profit: number; netSales: number; margin: number }>;
  };
}
