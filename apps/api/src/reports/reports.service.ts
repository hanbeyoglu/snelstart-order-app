import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SnelStartService } from '../snelstart/snelstart.service';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import {
  ReportType,
  ReportOrdersQuery,
  ReportOrder,
  ReportTopProduct,
  ReportResult,
  Verkooporder,
  VerkooporderRegel,
} from './types/report.types';

@Injectable()
export class ReportsService {
  constructor(
    private snelStartService: SnelStartService,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

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
}
