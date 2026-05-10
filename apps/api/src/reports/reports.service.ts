import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SnelStartService } from '../snelstart/snelstart.service';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { LocalOrder, LocalOrderDocument } from '../orders/schemas/local-order.schema';
import {
  AdvancedReportQuery,
  AdvancedReportResult,
  AdvancedTopProduct,
  CustomerAnalyticsItem,
  ReportType,
  ReportOrdersQuery,
  ReportOrder,
  ReportTopProduct,
  ReportResult,
  ReportKpi,
  TrendPoint,
  Verkooporder,
  VerkooporderRegel,
} from './types/report.types';

@Injectable()
export class ReportsService {
  constructor(
    private snelStartService: SnelStartService,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(LocalOrder.name) private orderModel: Model<LocalOrderDocument>,
  ) {}

  async getAdvancedReport(query: AdvancedReportQuery): Promise<AdvancedReportResult> {
    const { currentStart, currentEnd, previousStart, previousEnd } = this.resolveDateWindows(query);
    const [currentOrders, previousOrders, productDetails, customers] = await Promise.all([
      this.fetchLocalOrders(currentStart, currentEnd, query.customerId),
      this.fetchLocalOrders(previousStart, previousEnd, query.customerId),
      this.fetchAdvancedProductDetailsMap(),
      this.safeGetCustomers(),
    ]);
    const customerMap = new Map(customers.map((customer: any) => [customer.id, customer]));
    const currentLines = this.flattenOrderLines(currentOrders, productDetails, customerMap, query);
    const previousLines = this.flattenOrderLines(previousOrders, productDetails, customerMap, query);
    const allCurrentLines = this.flattenOrderLines(currentOrders, productDetails, customerMap, {
      ...query,
      search: undefined,
      purchasePriceFilter: 'all',
      profitFilter: 'all',
      categoryId: query.categoryId,
      productId: query.productId,
    });

    const topProductsAll = this.aggregateAdvancedTopProducts(currentLines);
    const sortedTopProducts = this.sortTopProducts(topProductsAll, query.sortBy, query.sortDir);
    const skip = Number(query.skip || 0);
    const top = Number(query.top || 100);

    const kpis = this.calculateKpis(allCurrentLines, currentOrders);
    const previousKpis = this.calculateKpis(previousLines, previousOrders);
    const customersAnalytics = this.aggregateCustomers(allCurrentLines);
    const vatByRate = this.aggregateVat(allCurrentLines);
    const profit = this.aggregateProfit(allCurrentLines);

    return {
      kpis,
      previousKpis,
      topProducts: sortedTopProducts.slice(skip, skip + top),
      topProductsTotalCount: sortedTopProducts.length,
      customers: customersAnalytics,
      trends: {
        daily: this.aggregateTrend(allCurrentLines, currentOrders, 'daily'),
        weekly: this.aggregateTrend(allCurrentLines, currentOrders, 'weekly'),
        monthly: this.aggregateTrend(allCurrentLines, currentOrders, 'monthly'),
        hourly: this.aggregateTrend(allCurrentLines, currentOrders, 'hourly'),
      },
      vat: {
        totalVat: kpis.totalVat,
        byRate: vatByRate,
      },
      profit,
    };
  }

  private resolveDateWindows(query: AdvancedReportQuery) {
    const currentEnd = query.endDate ? new Date(query.endDate) : new Date();
    currentEnd.setHours(23, 59, 59, 999);
    const currentStart = query.startDate ? new Date(query.startDate) : new Date(currentEnd);
    if (!query.startDate) currentStart.setDate(currentStart.getDate() - 29);
    currentStart.setHours(0, 0, 0, 0);
    const duration = Math.max(1, currentEnd.getTime() - currentStart.getTime());
    const previousEnd = new Date(currentStart.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - duration);
    return { currentStart, currentEnd, previousStart, previousEnd };
  }

  private async fetchLocalOrders(start: Date, end: Date, customerId?: string) {
    const query: any = {
      createdAt: { $gte: start, $lte: end },
    };
    if (customerId) query.customerId = customerId;
    return this.orderModel.find(query).lean().exec();
  }

  private money(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private safeNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private async safeGetCustomers(): Promise<any[]> {
    try {
      return await this.snelStartService.getCustomers();
    } catch {
      return [];
    }
  }

  private flattenOrderLines(
    orders: any[],
    productDetails: Map<string, any>,
    customerMap: Map<string, any>,
    query: AdvancedReportQuery,
  ) {
    const search = query.search?.trim().toLowerCase();
    return orders.flatMap((order: any) => {
      const createdAt = order.createdAt || order.updatedAt || new Date();
      const customer = customerMap.get(order.customerId);
      const customerName = customer?.naam || order.customerId || 'Bilinmeyen';
      return (order.items || []).map((item: any) => {
        const productId = item.childSnelstartId || item.productId;
        const details = productDetails.get(productId) || productDetails.get(String(productId).toLowerCase()) || {};
        const quantity = this.safeNumber(item.quantity);
        const unitPrice = this.safeNumber(item.unitPriceExclVat ?? item.unitPrice);
        const netSales = this.money(this.safeNumber(item.lineSubtotalExclVat ?? item.subtotalExclVat ?? item.totalPrice ?? unitPrice * quantity));
        const vatRate = this.safeNumber(item.vatRate ?? item.vatPercentage ?? details.vatRate);
        const vatAmount = this.money(this.safeNumber(item.lineVatAmount ?? item.vatAmount ?? (netSales * vatRate) / 100));
        const grossRevenue = this.money(this.safeNumber(item.lineTotalInclVat ?? item.totalInclVat ?? netSales + vatAmount));
        const purchasePrice = item.inkoopprijs ?? details.inkoopprijs ?? null;
        const numericPurchasePrice = purchasePrice == null ? null : this.safeNumber(purchasePrice, NaN);
        const missingPurchasePrice = !Number.isFinite(Number(numericPurchasePrice)) || Number(numericPurchasePrice) <= 0;
        const estimatedCost = missingPurchasePrice ? null : this.money(Number(numericPurchasePrice) * quantity);
        const estimatedProfit = estimatedCost == null ? null : this.money(netSales - estimatedCost);
        const categoryId = item.categoryId || details.artikelomzetgroepId || details.artikelgroepId || '';
        const categoryName = details.artikelomzetgroepOmschrijving || details.artikelgroepOmschrijving || item.vatGroupName || 'Onbekend';
        return {
          orderId: String(order._id || order.id),
          customerId: order.customerId,
          customerName,
          date: new Date(createdAt),
          productId,
          productName: item.productName || details.omschrijving || productId,
          artikelcode: item.sku || details.artikelcode || details.artikelnummer || '',
          categoryId,
          categoryName,
          contentQuantity: this.safeNumber(details.contentQuantity, 0),
          quantity,
          unitPrice,
          netSales,
          vatRate,
          vatAmount,
          grossRevenue,
          purchasePrice: missingPurchasePrice ? null : Number(numericPurchasePrice),
          estimatedCost,
          estimatedProfit,
          missingPurchasePrice,
          isChildItem: item.isChildItem === true,
        };
      });
    }).filter((line: any) => {
      if (query.categoryId && line.categoryId !== query.categoryId) return false;
      if (query.productId && line.productId !== query.productId) return false;
      if (search && ![line.productName, line.artikelcode, line.customerName].join(' ').toLowerCase().includes(search)) return false;
      if (query.purchasePriceFilter === 'with-price' && line.missingPurchasePrice) return false;
      if (query.purchasePriceFilter === 'without-price' && !line.missingPurchasePrice) return false;
      if (query.profitFilter === 'profitable' && !(line.estimatedProfit != null && line.estimatedProfit >= 0)) return false;
      if (query.profitFilter === 'loss' && !(line.estimatedProfit != null && line.estimatedProfit < 0)) return false;
      if (query.profitFilter === 'missing-cost' && !line.missingPurchasePrice) return false;
      return true;
    });
  }

  private calculateKpis(lines: any[], orders: any[]): ReportKpi {
    const orderIds = new Set(lines.map((line) => line.orderId));
    const customerIds = new Set(lines.map((line) => line.customerId).filter(Boolean));
    const netSales = this.money(lines.reduce((sum, line) => sum + line.netSales, 0));
    const totalVat = this.money(lines.reduce((sum, line) => sum + line.vatAmount, 0));
    const estimatedProfit = this.money(lines.reduce((sum, line) => sum + (line.estimatedProfit ?? 0), 0));
    return {
      totalOrders: orderIds.size || orders.length,
      totalRevenue: this.money(netSales + totalVat),
      totalVat,
      netSales,
      estimatedProfit,
      totalQuantity: this.money(lines.reduce((sum, line) => sum + line.quantity, 0)),
      activeCustomerCount: customerIds.size,
      averageBasket: orderIds.size ? this.money((netSales + totalVat) / orderIds.size) : 0,
      missingCostCount: lines.filter((line) => line.missingPurchasePrice).length,
    };
  }

  private aggregateAdvancedTopProducts(lines: any[]): AdvancedTopProduct[] {
    const byProduct = new Map<string, any>();
    for (const line of lines) {
      const current = byProduct.get(line.productId) || {
        productId: line.productId,
        productName: line.productName,
        artikelcode: line.artikelcode,
        categoryId: line.categoryId,
        categoryName: line.categoryName,
        totalQuantity: 0,
        soldCases: 0,
        netRevenue: 0,
        vatAmount: 0,
        grossRevenue: 0,
        purchasePrice: line.purchasePrice,
        salesPrice: line.unitPrice,
        estimatedProfit: 0,
        lastSaleDate: line.date,
        customers: new Set<string>(),
        returnCount: 0,
        missingPurchasePrice: false,
        profitLineCount: 0,
      };
      current.totalQuantity += line.quantity;
      current.soldCases += line.contentQuantity > 0 ? line.quantity / line.contentQuantity : 0;
      current.netRevenue += line.netSales;
      current.vatAmount += line.vatAmount;
      current.grossRevenue += line.grossRevenue;
      current.salesPrice = line.unitPrice;
      current.purchasePrice = line.purchasePrice ?? current.purchasePrice;
      current.missingPurchasePrice = current.missingPurchasePrice || line.missingPurchasePrice;
      if (line.estimatedProfit != null) {
        current.estimatedProfit += line.estimatedProfit;
        current.profitLineCount += 1;
      }
      if (line.date > current.lastSaleDate) current.lastSaleDate = line.date;
      if (line.customerId) current.customers.add(line.customerId);
      byProduct.set(line.productId, current);
    }
    return Array.from(byProduct.values()).map((item) => {
      const estimatedProfit = item.profitLineCount > 0 ? this.money(item.estimatedProfit) : null;
      return {
        productId: item.productId,
        productName: item.productName,
        artikelcode: item.artikelcode,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        totalQuantity: this.money(item.totalQuantity),
        soldCases: this.money(item.soldCases),
        netRevenue: this.money(item.netRevenue),
        vatAmount: this.money(item.vatAmount),
        grossRevenue: this.money(item.grossRevenue),
        purchasePrice: item.purchasePrice,
        salesPrice: this.money(item.salesPrice),
        estimatedProfit,
        profitMargin: estimatedProfit == null || item.netRevenue <= 0 ? null : this.money((estimatedProfit / item.netRevenue) * 100),
        lastSaleDate: item.lastSaleDate?.toISOString?.(),
        customerCount: item.customers.size,
        returnCount: item.returnCount,
        missingPurchasePrice: item.missingPurchasePrice,
      };
    });
  }

  private sortTopProducts(items: AdvancedTopProduct[], sortBy = 'netRevenue', sortDir: 'asc' | 'desc' = 'desc') {
    const direction = sortDir === 'asc' ? 1 : -1;
    return [...items].sort((a: any, b: any) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv)) * direction;
      return (Number(av) - Number(bv)) * direction;
    });
  }

  private aggregateCustomers(lines: any[]): CustomerAnalyticsItem[] {
    const map = new Map<string, any>();
    for (const line of lines) {
      const current = map.get(line.customerId) || {
        customerId: line.customerId,
        customerName: line.customerName,
        orderIds: new Set<string>(),
        totalRevenue: 0,
        netSales: 0,
        vatAmount: 0,
        lastOrderDate: line.date,
        products: new Map<string, { name: string; quantity: number }>(),
      };
      current.orderIds.add(line.orderId);
      current.totalRevenue += line.grossRevenue;
      current.netSales += line.netSales;
      current.vatAmount += line.vatAmount;
      if (line.date > current.lastOrderDate) current.lastOrderDate = line.date;
      const product = current.products.get(line.productId) || { name: line.productName, quantity: 0 };
      product.quantity += line.quantity;
      current.products.set(line.productId, product);
      map.set(line.customerId, current);
    }
    const now = Date.now();
    return Array.from(map.values()).map((item) => {
      const orderCount = item.orderIds.size;
      const topProduct = Array.from(item.products.values()).sort((a: any, b: any) => b.quantity - a.quantity)[0] as any;
      const daysSinceLastOrder = item.lastOrderDate ? (now - item.lastOrderDate.getTime()) / 86400000 : null;
      const segment: CustomerAnalyticsItem['segment'] =
        item.totalRevenue >= 5000
          ? 'valuable'
          : daysSinceLastOrder != null && daysSinceLastOrder > 45
            ? 'inactive'
            : 'active';
      return {
        customerId: item.customerId,
        customerName: item.customerName,
        orderCount,
        totalRevenue: this.money(item.totalRevenue),
        netSales: this.money(item.netSales),
        vatAmount: this.money(item.vatAmount),
        averageBasket: orderCount ? this.money(item.totalRevenue / orderCount) : 0,
        topProductName: topProduct?.name,
        lastOrderDate: item.lastOrderDate?.toISOString?.(),
        orderFrequencyDays: null,
        lifetimeValue: this.money(item.totalRevenue),
        segment,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  private aggregateVat(lines: any[]) {
    const map = new Map<number, any>();
    for (const line of lines) {
      const current = map.get(line.vatRate) || { vatRate: line.vatRate, vatAmount: 0, netSales: 0, grossRevenue: 0 };
      current.vatAmount += line.vatAmount;
      current.netSales += line.netSales;
      current.grossRevenue += line.grossRevenue;
      map.set(line.vatRate, current);
    }
    return Array.from(map.values())
      .filter((item) => item.vatAmount > 0)
      .map((item) => ({
        vatRate: item.vatRate,
        vatAmount: this.money(item.vatAmount),
        netSales: this.money(item.netSales),
        grossRevenue: this.money(item.grossRevenue),
      }))
      .sort((a, b) => a.vatRate - b.vatRate);
  }

  private aggregateProfit(lines: any[]) {
    const validLines = lines.filter((line) => line.estimatedProfit != null);
    const totalProfit = this.money(validLines.reduce((sum, line) => sum + line.estimatedProfit, 0));
    const netSales = this.money(validLines.reduce((sum, line) => sum + line.netSales, 0));
    const group = (keyFn: (line: any) => string, nameFn: (line: any) => string) => {
      const map = new Map<string, any>();
      for (const line of validLines) {
        const key = keyFn(line);
        const current = map.get(key) || { id: key, name: nameFn(line), profit: 0, netSales: 0 };
        current.profit += line.estimatedProfit;
        current.netSales += line.netSales;
        map.set(key, current);
      }
      return Array.from(map.values()).map((item) => ({
        id: item.id,
        name: item.name,
        profit: this.money(item.profit),
        netSales: this.money(item.netSales),
        margin: item.netSales > 0 ? this.money((item.profit / item.netSales) * 100) : 0,
      })).sort((a, b) => b.profit - a.profit);
    };
    return {
      totalProfit,
      profitMargin: netSales > 0 ? this.money((totalProfit / netSales) * 100) : 0,
      missingCostCount: lines.filter((line) => line.missingPurchasePrice).length,
      byCategory: group((line) => line.categoryId || 'unknown', (line) => line.categoryName || 'Onbekend')
        .map((item) => ({ categoryId: item.id, categoryName: item.name, profit: item.profit, netSales: item.netSales, margin: item.margin })),
      byCustomer: group((line) => line.customerId || 'unknown', (line) => line.customerName || 'Bilinmeyen')
        .map((item) => ({ customerId: item.id, customerName: item.name, profit: item.profit, netSales: item.netSales, margin: item.margin })),
    };
  }

  private aggregateTrend(lines: any[], orders: any[], granularity: 'daily' | 'weekly' | 'monthly' | 'hourly'): TrendPoint[] {
    const map = new Map<string, any>();
    const orderIdsByKey = new Map<string, Set<string>>();
    const labelFor = (date: Date) => {
      if (granularity === 'hourly') return `${String(date.getHours()).padStart(2, '0')}:00`;
      if (granularity === 'monthly') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (granularity === 'weekly') {
        const start = new Date(date);
        start.setDate(date.getDate() - date.getDay());
        return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      }
      return date.toISOString().slice(0, 10);
    };
    for (const line of lines) {
      const key = labelFor(line.date);
      const current = map.get(key) || { key, label: key, orders: 0, revenue: 0, netSales: 0, vatAmount: 0, profit: 0, quantity: 0 };
      current.revenue += line.grossRevenue;
      current.netSales += line.netSales;
      current.vatAmount += line.vatAmount;
      current.profit += line.estimatedProfit ?? 0;
      current.quantity += line.quantity;
      map.set(key, current);
      const orderIds = orderIdsByKey.get(key) || new Set<string>();
      orderIds.add(line.orderId);
      orderIdsByKey.set(key, orderIds);
    }
    return Array.from(map.values()).map((item) => ({
      key: item.key,
      label: item.label,
      orders: orderIdsByKey.get(item.key)?.size || 0,
      revenue: this.money(item.revenue),
      netSales: this.money(item.netSales),
      vatAmount: this.money(item.vatAmount),
      profit: this.money(item.profit),
      quantity: this.money(item.quantity),
    })).sort((a, b) => a.key.localeCompare(b.key));
  }

  /**
   * Get report data based on type.
   * tenantId/siteId are accepted for API compatibility but SnelStart has no multi-tenant concept;
   * they could be used for future filtering.
   */
  async getReportData(query: ReportOrdersQuery): Promise<ReportResult<ReportOrder> | ReportResult<ReportTopProduct>> {
    const { type, startDate, endDate, skip = 0, top = 100 } = query;

    const allOrders = await this.fetchAllOrdersInRange(query);

    if (type === 'orders') {
      const sorted = this.sortOrdersNewestFirst(allOrders);
      const totalCount = sorted.length;
      const page = sorted.slice(skip, skip + top);
      const customers = await this.snelStartService.getCustomers();
      const customerMap = new Map(customers.map((c: any) => [c.id, c]));

      return {
        items: page.map((o) => this.mapToReportOrder(o, customerMap)),
        totalCount,
      };
    }

    let allProducts = await this.aggregateTopProducts(allOrders);
    const filter = query.purchasePriceFilter || 'all';
    if (filter === 'with-price') {
      allProducts = allProducts.filter((p) => (p.purchasePrice ?? 0) > 0);
    } else if (filter === 'without-price') {
      allProducts = allProducts.filter((p) => !(p.purchasePrice != null && p.purchasePrice > 0));
    }
    return {
      items: allProducts.slice(skip, skip + top),
      totalCount: allProducts.length,
    };
  }

  /** Fetch orders from SnelStart. Date filter applied client-side. */
  private async fetchAllOrdersInRange(query: ReportOrdersQuery): Promise<Verkooporder[]> {
    const { tenantId, siteId, startDate, endDate, type } = query;
    // tenantId/siteId: reserved for future multi-tenant; SnelStart API uses relatie (customerId) only
    const customerId = query.tenantId || undefined;

    const allOrders: Verkooporder[] = [];
    let skip = 0;
    const batchSize = 500;

    while (true) {
      const batch = await this.snelStartService.getVerkoopordersPaginated(
        skip,
        batchSize,
        customerId,
      );
      if (batch.length === 0) break;

      for (const order of batch) {
        if (this.isOrderInDateRange(order, startDate, endDate)) {
          allOrders.push(order);
        }
      }

      if (batch.length < batchSize) break;
      skip += batchSize;

      // For orders type with pagination, we might stop early when we have enough
      // For top-products we need all orders in range
      if (type === 'orders' && query.top && allOrders.length >= (query.skip || 0) + (query.top || 100)) {
        // We have enough for current page, but we'd need full set for correct sort - fetch all for simplicity
      }
    }

    return allOrders;
  }

  private isOrderInDateRange(
    order: Verkooporder,
    startDate?: string,
    endDate?: string,
  ): boolean {
    const orderDate = order.datum ? new Date(order.datum) : null;
    if (!orderDate) return true;

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (orderDate < start) return false;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (orderDate > end) return false;
    }

    return true;
  }

  private sortOrdersNewestFirst(orders: Verkooporder[]): Verkooporder[] {
    return [...orders].sort((a, b) => {
      const da = new Date(a.datum || 0).getTime();
      const db = new Date(b.datum || 0).getTime();
      return db - da;
    });
  }

  private mapToReportOrder(
    order: Verkooporder,
    customerMap: Map<string, any>,
  ): ReportOrder {
    const customerId = order.relatie?.id;
    const customer = customerMap.get(customerId);
    const customerName = customer?.naam || order.relatie?.naam || 'Bilinmeyen';

    const total =
      order.regels?.reduce(
        (sum: number, r: VerkooporderRegel) => sum + (r.aantal || 0) * (r.stuksprijs || 0),
        0,
      ) ?? 0;

    return {
      id: order.id,
      orderNo: order.ordernummer,
      customerId: customerId || '',
      customerName,
      date: order.datum,
      total,
      procesStatus: order.procesStatus,
    };
  }

  private async aggregateTopProducts(orders: Verkooporder[]): Promise<ReportTopProduct[]> {
    // SnelStart verkooporder regels'de inkoopprijs yok; ürün (artikel) kaydından alınır
    const productDetails = await this.fetchProductDetailsMap();

    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        totalQuantity: number;
        lastSalesPrice: number;
        lastPurchasePrice: number;
        totalRevenue: number;
        totalCost: number;
      }
    >();

    for (const order of orders) {
      for (const regel of order.regels || []) {
        const productId = this.extractProductIdFromRegel(regel);
        const qty = regel.aantal || 0;
        const salesPrice = regel.stuksprijs || 0;
        const details = productDetails.get(productId) ?? productDetails.get(productId?.toLowerCase?.());
        const purchasePrice = regel.inkoopprijs ?? details?.inkoopprijs ?? 0;
        const productName = regel.omschrijving || details?.omschrijving || `Ürün ${productId}`;

        if (!productMap.has(productId)) {
          productMap.set(productId, {
            productId,
            productName,
            totalQuantity: 0,
            lastSalesPrice: salesPrice,
            lastPurchasePrice: purchasePrice,
            totalRevenue: 0,
            totalCost: 0,
          });
        }

        const agg = productMap.get(productId)!;
        agg.totalQuantity += qty;
        agg.lastSalesPrice = salesPrice;
        agg.lastPurchasePrice = purchasePrice;
        agg.totalRevenue += qty * salesPrice;
        agg.totalCost += qty * purchasePrice;
      }
    }

    const result: ReportTopProduct[] = Array.from(productMap.values()).map(
      (agg) => {
        const details = productDetails.get(agg.productId) ?? productDetails.get(agg.productId?.toLowerCase?.());
        const name = details?.omschrijving || agg.productName;
        return {
          productId: agg.productId,
          productName: name,
          totalQuantity: agg.totalQuantity,
          salesPrice: agg.lastSalesPrice,
          purchasePrice: agg.lastPurchasePrice,
          totalRevenue: agg.totalRevenue,
          totalCost: agg.totalCost,
          totalProfit: agg.totalRevenue - agg.totalCost,
        };
      },
    );

    result.sort((a, b) => b.totalQuantity - a.totalQuantity);
    return result;
  }

  /**
   * SnelStart verkooporder regel'deki artikel id'yi çıkar.
   * API bazen { id }, bazen { uri: "/v2/artikelen/guid" } dönebilir.
   */
  private extractProductIdFromRegel(regel: VerkooporderRegel): string {
    if (regel.artikelId) return regel.artikelId;
    if (regel.artikel?.id) return regel.artikel.id;
    const uri = regel.artikel?.uri;
    if (uri) {
      const match = uri.match(/\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/);
      if (match) return match[1];
    }
    return 'unknown';
  }

  /**
   * MongoDB'dan tüm ürünleri al (SnelStart'tan ilk 500 ile sınırlı değil).
   * snelstartId = SnelStart artikel id = sipariş regel artikel id.
   */
  private async fetchProductDetailsMap(): Promise<
    Map<string, { omschrijving: string; inkoopprijs: number }>
  > {
    const map = new Map<string, { omschrijving: string; inkoopprijs: number }>();
    try {
      const products = await this.productModel
        .find({ isActive: { $ne: false } })
        .select('snelstartId omschrijving inkoopprijs')
        .lean()
        .exec();
      for (const p of products) {
        const id = (p as any).snelstartId;
        if (id) {
          const entry = {
            omschrijving: (p as any).omschrijving || '',
            inkoopprijs: (p as any).inkoopprijs ?? 0,
          };
          map.set(id, entry);
          map.set(id.toLowerCase(), entry);
        }
      }
    } catch {
      // Fallback: SnelStart API'dan ilk 500 ürün
      try {
        const products = (await this.snelStartService.getProducts()) as any[];
        for (const p of products) {
          if (p.id) {
            map.set(p.id, {
              omschrijving: p.omschrijving || '',
              inkoopprijs: p.inkoopprijs ?? 0,
            });
          }
        }
      } catch {
        /* empty */
      }
    }
    return map;
  }

  private async fetchAdvancedProductDetailsMap(): Promise<Map<string, any>> {
    const map = new Map<string, any>();
    try {
      const products = await this.productModel
        .find({})
        .select(
          'snelstartId omschrijving artikelnummer artikelcode inkoopprijs contentQuantity artikelgroepId artikelgroepOmschrijving artikelomzetgroepId artikelomzetgroepOmschrijving vatRate',
        )
        .lean()
        .exec();
      for (const product of products as any[]) {
        if (!product.snelstartId) continue;
        map.set(product.snelstartId, product);
        map.set(String(product.snelstartId).toLowerCase(), product);
      }
    } catch {
      return map;
    }
    return map;
  }
}
