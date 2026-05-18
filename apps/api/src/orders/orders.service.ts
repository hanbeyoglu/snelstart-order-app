import { BadRequestException, ForbiddenException, Injectable, Inject, Optional, forwardRef, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LocalOrder, LocalOrderDocument } from './schemas/local-order.schema';
import { SnelStartService } from '../snelstart/snelstart.service';
import { AuditService } from '../audit/audit.service';
import { CustomersService } from '../customers/customers.service';
import { CategoriesService } from '../categories/categories.service';
import { createOrderSchema } from '@snelstart-order-app/shared';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { ProductsService } from '../products/products.service';
import { PricingService } from '../pricing/pricing.service';
import { parseOrBadRequest } from '../common/validation/zod-validation';
import { OrderNotificationService } from './order-notification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PriceOverridePolicyService } from '../auth/price-override-policy.service';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { getEffectivePermissions } from '../auth/permissions';
import { randomUUID } from 'node:crypto';

export interface OrderListFilters {
  status?: string;
  deliveryType?: string;
  deliveryTiming?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  customerId?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

const ALLOWED_SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  total_desc: { totalInclVat: -1, total: -1 },
  total_asc: { totalInclVat: 1, total: 1 },
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(LocalOrder.name) private orderModel: Model<LocalOrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectQueue('order-sync') private orderSyncQueue: Queue,
    private snelStartService: SnelStartService,
    private auditService: AuditService,
    @Inject(forwardRef(() => CustomersService)) private customersService: CustomersService,
    private productsService: ProductsService,
    private pricingService: PricingService,
    private categoriesService: CategoriesService,
    private priceOverridePolicyService: PriceOverridePolicyService,
    @Optional() private orderNotificationService?: OrderNotificationService,
    @Optional() private notificationsService?: NotificationsService,
  ) {}

  private async resolvePricePolicyUser(user?: any) {
    if (!user?.userId) {
      return user;
    }
    const dbUser = await this.userModel
      .findById(user.userId)
      .select('role permissions priceOverrideLimitPercent')
      .lean()
      .exec();
    if (!dbUser) {
      return user;
    }
    return {
      ...user,
      role: user.role ?? dbUser.role,
      permissions: getEffectivePermissions(dbUser.role, dbUser.permissions),
      priceOverrideLimitPercent: dbUser.priceOverrideLimitPercent,
    };
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private money(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private getUserFullName(user?: any): string | undefined {
    const fullName = [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || user?.username || user?.email || undefined;
  }

  private async buildOrderCreatorSnapshot(user: any, customerId: string) {
    const snapshot: Record<string, any> = {
      createdByUserId: user?.userId,
      createdByUsername: user?.username,
      createdByFullName: this.getUserFullName(user),
      createdByRole: user?.role,
    };

    if (user?.role === 'customer') {
      const userCustomerId = this.requireCustomerId(user);
      const customer = await this.customersService.getCustomerById(userCustomerId);
      if (!customer) {
        throw new NotFoundException('Customer kullanıcı bağlı müşteri kaydı bulunamadı');
      }

      snapshot.createdByCustomerId = userCustomerId;
      snapshot.createdByCustomerName =
        customer.storeName ||
        customer.companyName ||
        customer.naam ||
        customer.name ||
        customerId;
    }

    return snapshot;
  }

  private getCreatorNoteLine(order: Partial<LocalOrder> | Record<string, any>): string | undefined {
    if (order.createdByRole === 'customer') {
      const customerName = order.createdByCustomerName || order.createdByCustomerId;
      return customerName ? `Oluşturan müşteri: ${customerName}` : undefined;
    }

    const creatorName = order.createdByFullName || order.createdByUsername;
    return creatorName ? `Oluşturan: ${creatorName}` : undefined;
  }

  private appendCreatorNote(existingNote: string | undefined, order: Partial<LocalOrder> | Record<string, any>) {
    const baseNote = (existingNote || '').trim();
    const creatorLine = this.getCreatorNoteLine(order);

    if (!creatorLine) {
      return baseNote;
    }

    return baseNote ? `${baseNote}\n${creatorLine}` : creatorLine;
  }

  private buildSnelStartPayload(order: Partial<LocalOrder> | Record<string, any>, date: Date = new Date()) {
    const dateOnly = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).toISOString().split('T')[0];

    return {
      relatie: {
        id: order.customerId,
      },
      datum: `${dateOnly}T00:00:00`,
      verkooporderBtwIngaveModel: 'Exclusief',
      regels: (order.items || []).map((item: any) => ({
        artikel: {
          id: item.productId,
        },
        aantal: item.quantity,
        stuksprijs: item.unitPrice,
      })),
      memo: this.appendCreatorNote(
        this.appendDeliveryNote((order as any).memo || 'Özel yazılımdan gelen sipariş', order),
        order,
      ),
    };
  }

  private appendDeliveryNote(
    existingNote: string | undefined,
    order: Partial<LocalOrder> | Record<string, any>,
  ): string | undefined {
    const baseNote = (existingNote || '').trim();
    const segments: string[] = [];
    const deliveryType = (order as any).deliveryType;
    const deliveryTiming = (order as any).deliveryTiming;
    const deliveryDate = (order as any).deliveryDate;
    if (deliveryType) {
      const label = deliveryType === 'warehouse_pickup' ? 'Depodan Teslim Alınacak' : 'Markete Teslim';
      segments.push(`Teslimat: ${label}`);
    }
    if (deliveryTiming) {
      let line = deliveryTiming === 'asap' ? 'Teslimat zamanı: Hemen' : 'Teslimat zamanı: Belirli tarih';
      if (deliveryTiming === 'scheduled' && deliveryDate) {
        const parsed = deliveryDate instanceof Date ? deliveryDate : new Date(deliveryDate);
        if (!Number.isNaN(parsed.getTime())) {
          line = `Teslimat zamanı: Belirli tarih: ${parsed.toISOString().split('T')[0]}`;
        }
      }
      segments.push(line);
    }
    if (segments.length === 0) {
      return baseNote || undefined;
    }
    const deliveryBlock = segments.join('\n');
    if (!baseNote) {
      return deliveryBlock;
    }
    // Avoid duplicating delivery lines if already present in memo
    const baseLower = baseNote.toLowerCase();
    if (baseLower.includes('teslimat:') || baseLower.includes('teslimat zamanı:')) {
      return baseNote;
    }
    return `${baseNote}\n${deliveryBlock}`;
  }

  private parseDeliveryDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? undefined : value;
    }
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private generateOrderNumber(now: Date = new Date()): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const suffix = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
    return `SO-${year}${month}${day}-${suffix}`;
  }

  private getVatRate(source: any): number {
    const parsed = Number(source?.vatRate ?? source?.btwPercentage ?? source?.vatPercentage ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  private calculateOrderTotals(items: any[]) {
    const breakdownByRate = new Map<number, { vatRate: number; subtotalExclVat: number; vatAmount: number; totalInclVat: number }>();
    const enrichedItems = items.map((item) => {
      const lineSubtotal = this.money(Number(item.unitPrice || 0) * Number(item.quantity || 0));
      const vatRate = this.getVatRate(item);
      const vatAmount = this.money((lineSubtotal * vatRate) / 100);
      const totalInclVat = this.money(lineSubtotal + vatAmount);
      const current = breakdownByRate.get(vatRate) || {
        vatRate,
        subtotalExclVat: 0,
        vatAmount: 0,
        totalInclVat: 0,
      };
      current.subtotalExclVat = this.money(current.subtotalExclVat + lineSubtotal);
      current.vatAmount = this.money(current.vatAmount + vatAmount);
      current.totalInclVat = this.money(current.totalInclVat + totalInclVat);
      breakdownByRate.set(vatRate, current);

      return {
        ...item,
        unitPriceExclVat: this.money(Number(item.unitPrice || 0)),
        totalPrice: lineSubtotal,
        vatPercentage: vatRate,
        vatRate,
        subtotalExclVat: lineSubtotal,
        vatAmount,
        lineSubtotalExclVat: lineSubtotal,
        lineVatAmount: vatAmount,
        lineTotalInclVat: totalInclVat,
        totalInclVat,
      };
    });
    const subtotalExclVat = this.money(enrichedItems.reduce((sum, item) => sum + item.subtotalExclVat, 0));
    const vatAmount = this.money(Array.from(breakdownByRate.values()).reduce((sum, item) => sum + item.vatAmount, 0));
    const totalInclVat = this.money(subtotalExclVat + vatAmount);

    return {
      items: enrichedItems,
      subtotalExclVat,
      vatAmount,
      vatTotal: vatAmount,
      totalInclVat,
      vatBreakdown: Array.from(breakdownByRate.values()).sort((a, b) => a.vatRate - b.vatRate),
    };
  }

  private async validateOrderPrices(items: any[], user?: any) {
    const policyUser = await this.resolvePricePolicyUser(user);
    const productIds = items
      .filter((item) => item.isChildItem !== true)
      .map((item) => item.productId);
    const products = await this.productModel
      .find({ snelstartId: { $in: productIds } })
      .select('snelstartId verkoopprijs inkoopprijs')
      .lean()
      .exec();
    const productById = new Map<string, any>(
      products.map((product: any) => [product.snelstartId, product]),
    );

    for (const item of items) {
      if (item.isChildItem === true) {
        continue;
      }
      const product = productById.get(item.productId);
      const unitPrice = Number(item.unitPrice);
      const basePrice = product?.verkoopprijs ?? item.basePrice ?? unitPrice;
      const purchasePrice = product?.inkoopprijs;
      const trustedUnitPrice = Number(item.basePrice ?? basePrice);

      if (!Number.isFinite(unitPrice) || unitPrice === trustedUnitPrice) {
        continue;
      }

      try {
        this.priceOverridePolicyService.assertCanOverridePrice(
          policyUser,
          unitPrice,
          basePrice,
          purchasePrice,
        );
      } catch (error) {
        void this.auditService.log({
          action: 'PRICE_OVERRIDE_REJECTED',
          entityType: 'LocalOrder',
          entityId: item.productId,
          userId: user?.userId,
          actorRole: user?.role,
          metadata: {
            requestedUnitPrice: unitPrice,
            basePrice,
            purchasePrice,
          },
        });
        throw error;
      }
    }
  }

  async createOrder(orderData: any, user?: any) {
    const requested = parseOrBadRequest(createOrderSchema, orderData) as any;
    const effectiveCustomerId = this.resolveOrderCustomerId(requested.customerId, user);

    // Check idempotency
    const existing = await this.orderModel
      .findOne({ idempotencyKey: requested.idempotencyKey })
      .exec();
    if (existing) {
      return existing;
    }

    const creatorSnapshot = await this.buildOrderCreatorSnapshot(user, effectiveCustomerId);

    const trustedItems = await this.buildTrustedOrderItems(
      requested.items,
      effectiveCustomerId,
      user,
    );
    const totals = this.calculateOrderTotals(trustedItems);
    const parsedDeliveryDate = this.parseDeliveryDate(requested.deliveryDate);
    const validated = {
      idempotencyKey: requested.idempotencyKey,
      customerId: effectiveCustomerId,
      memo: requested.memo,
      items: totals.items,
      deliveryType: requested.deliveryType ?? null,
      deliveryTiming: requested.deliveryTiming ?? null,
      ...(parsedDeliveryDate ? { deliveryDate: parsedDeliveryDate } : {}),
      ...creatorSnapshot,
    };

    // Create local order
    const order = new this.orderModel({
      ...validated,
      orderNumber: this.generateOrderNumber(),
      subtotal: totals.subtotalExclVat,
      total: totals.totalInclVat,
      subtotalExclVat: totals.subtotalExclVat,
      vatAmount: totals.vatAmount,
      vatTotal: totals.vatTotal,
      totalInclVat: totals.totalInclVat,
      vatBreakdown: totals.vatBreakdown,
      status: 'PENDING_SYNC',
    });
    await order.save();

    if (user?.role === 'customer') {
      await this.auditService.log({
        action: 'CUSTOMER_ORDER_CREATED',
        entityType: 'LocalOrder',
        entityId: order._id.toString(),
        userId: user?.userId,
        actorRole: user?.role,
        metadata: { customerId: effectiveCustomerId, total: totals.totalInclVat, createdBy: creatorSnapshot },
      });
    }
    void this.notifyOrderCreated(order, user, effectiveCustomerId);
    void this.notificationsService?.createOrderNotification(order, user);

    // Try to sync immediately
    try {
      // SnelStart sipariş formatını oluştur
      const snelStartPayload = this.buildSnelStartPayload(order);

      const snelStartOrder = await this.snelStartService.createSalesOrder(snelStartPayload);

      order.status = 'SYNCED';
      order.snelstartOrderId = snelStartOrder.id;
      order.syncedAt = new Date();
      await order.save();

      await this.auditService.log({
        action: 'ORDER_SYNCED',
        entityType: 'LocalOrder',
        entityId: order._id.toString(),
        userId: user?.userId,
        actorRole: user?.role,
        metadata: { snelstartOrderId: snelStartOrder.id },
      });

      return order;
    } catch (error: any) {
      // Enqueue for retry
      await this.orderSyncQueue.add(
        'sync-order',
        { orderId: order._id.toString() },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      await this.auditService.log({
        action: 'ORDER_SYNC_FAILED',
        entityType: 'LocalOrder',
        entityId: order._id.toString(),
        userId: user?.userId,
        actorRole: user?.role,
        metadata: { error: error.message },
      });

      return order;
    }
  }

  async getOrders(filters?: OrderListFilters | any, user?: any) {
    const raw = filters || {};
    const query: FilterQuery<LocalOrderDocument> = {};

    // Customer scope: hard restrict to own customer + own user
    if (user?.role === 'customer') {
      query.customerId = this.requireCustomerId(user);
      query.createdByUserId = this.requireCustomerUserId(user);
    } else if (raw.customerId) {
      query.customerId = String(raw.customerId);
    }

    if (raw.status) {
      const statuses = String(raw.status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length === 1) {
        query.status = statuses[0];
      } else if (statuses.length > 1) {
        query.status = { $in: statuses };
      }
    }

    if (raw.deliveryType) {
      const types = String(raw.deliveryType)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (types.length === 1) {
        query.deliveryType = types[0];
      } else if (types.length > 1) {
        query.deliveryType = { $in: types };
      }
    }

    if (raw.deliveryTiming) {
      const timings = String(raw.deliveryTiming)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (timings.length === 1) {
        query.deliveryTiming = timings[0];
      } else if (timings.length > 1) {
        query.deliveryTiming = { $in: timings };
      }
    }

    if (raw.dateFrom || raw.dateTo) {
      const range: Record<string, Date> = {};
      const from = this.parseDateBoundary(raw.dateFrom, 'start');
      const to = this.parseDateBoundary(raw.dateTo, 'end');
      if (from) range.$gte = from;
      if (to) range.$lte = to;
      if (Object.keys(range).length > 0) {
        query.createdAt = range;
      }
    }

    if (raw.search) {
      const term = String(raw.search).trim();
      if (term) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        query.$or = [
          { orderNumber: regex },
          { snelstartOrderId: regex },
          { memo: regex },
          { 'items.productName': regex },
          { 'items.sku': regex },
          { 'items.productId': regex },
        ];
      }
    }

    const sortKey = String(raw.sort || 'newest');
    const sort = ALLOWED_SORTS[sortKey] || ALLOWED_SORTS.newest;

    const limit = Math.min(Math.max(Number(raw.limit) || 10, 1), 100);
    const page = Math.max(Number(raw.page) || 1, 1);
    const skip = (page - 1) * limit;

    const wantsPagination = raw.page !== undefined || raw.limit !== undefined;

    if (!wantsPagination) {
      // Backward compatible: return array (existing staff UI still expects array)
      return this.orderModel
        .find(query)
        .sort(sort)
        .limit(500)
        .exec();
    }

    const [data, total] = await Promise.all([
      this.orderModel.find(query).sort(sort).skip(skip).limit(limit).exec(),
      this.orderModel.countDocuments(query).exec(),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        hasNext: skip + data.length < total,
        hasPrev: page > 1,
      },
    };
  }

  private parseDateBoundary(value: unknown, edge: 'start' | 'end'): Date | undefined {
    if (!value) return undefined;
    const str = String(value).trim();
    if (!str) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [year, month, day] = str.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      if (Number.isNaN(date.getTime())) return undefined;
      if (edge === 'end') {
        date.setHours(23, 59, 59, 999);
      } else {
        date.setHours(0, 0, 0, 0);
      }
      return date;
    }
    const parsed = new Date(str);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private async buildTrustedOrderItems(
    items: Array<any>,
    customerId: string,
    user?: any,
  ) {
    const policyUser = await this.resolvePricePolicyUser(user);
    const trustedItems = [];

    for (const item of items.filter((cartItem) => cartItem.isChildItem !== true)) {
      const product: any = await this.productsService.getProductById(item.productId, customerId);
      const basePrice = Number(product.basePrice || product.verkoopprijs || 0);
      const trustedUnitPrice = Number(product.finalPrice ?? basePrice);
      const vatRate = this.getVatRate(product);
      const requestedUnitPrice = Number(item.unitPrice);
      const hasRequestedPrice = Number.isFinite(requestedUnitPrice);
      const priceChanged = hasRequestedPrice && requestedUnitPrice !== trustedUnitPrice;

      let unitPrice = trustedUnitPrice;
      let manualPriceOverride: Record<string, unknown> | undefined;

      if (priceChanged) {
        const validation = this.priceOverridePolicyService.assertCanOverridePrice(
          policyUser,
          requestedUnitPrice,
          basePrice,
          product.inkoopprijs,
        );

        unitPrice = requestedUnitPrice;
        manualPriceOverride = {
          previousUnitPrice: trustedUnitPrice,
          newUnitPrice: unitPrice,
          overrideType: validation.overrideType,
          changedByUserId: user?.userId,
          changedByUsername: user?.username,
          limitPercent: validation.policy.limitPercent,
        };

        void this.auditService.log({
          action: 'PRICE_OVERRIDE_APPLIED',
          entityType: 'Product',
          entityId: product.id || item.productId,
          userId: user?.userId,
          actorRole: user?.role,
          metadata: manualPriceOverride,
        });
      }

      trustedItems.push({
        productId: product.id || item.productId,
        productName: product.omschrijving,
        sku: product.artikelnummer || product.artikelcode || '',
        categoryId:
          product.artikelomzetgroepId ||
          product.artikelgroepId ||
          product.artikelOmzetgroep?.id,
        quantity: this.positiveNumber(item.quantity, 1),
        unitPrice,
        basePrice,
        totalPrice: unitPrice * this.positiveNumber(item.quantity, 1),
        vatPercentage: vatRate,
        vatType: product.vatType ?? null,
        vatRate,
        vatGroupId: product.vatGroupId,
        vatGroupName: product.vatGroupName,
        lineType: 'product',
        ...(priceChanged
          ? {
              customUnitPrice: unitPrice,
              adminOverride: true,
              adminPriceOverrideConfirmed: item.adminPriceOverrideConfirmed === true,
              adminOverrideReason: item.adminOverrideReason,
              manualPriceOverride,
            }
          : {}),
      });

      for (const subArticle of product.subArticles || []) {
        const dbChild = subArticle.childProduct
          ? await this.productModel
              .findOne({ snelstartId: subArticle.childSnelstartId })
              .select('snelstartId omschrijving artikelnummer artikelcode verkoopprijs inkoopprijs vatType vatRate vatGroupId vatGroupName eenheid voorraad')
              .lean()
              .exec()
          : null;
        const child = dbChild || subArticle.childProduct || null;
        const quantityPerParent = this.positiveNumber(subArticle.quantityPerParent, 1);
        const parentQuantity = this.positiveNumber(item.quantity, 1);
        const childQuantity = parentQuantity * quantityPerParent;
        const childUnitPrice = this.positiveNumber(child?.verkoopprijs, 0);
        const childVatRate = this.getVatRate(child);

        trustedItems.push({
          productId: subArticle.childSnelstartId,
          productName: child?.omschrijving || 'Alt ürün bulunamadı',
          sku: child?.artikelnummer || child?.artikelcode || subArticle.childArtikelcode || '',
          quantity: childQuantity,
          unitPrice: childUnitPrice,
          basePrice: childUnitPrice,
          totalPrice: childUnitPrice * childQuantity,
          vatPercentage: childVatRate,
          vatType: child?.vatType ?? null,
          vatRate: childVatRate,
          vatGroupId: child?.vatGroupId,
          vatGroupName: child?.vatGroupName,
          isChildItem: true,
          lineType: 'recipe_child',
          parentProductId: product.id || item.productId,
          childSnelstartId: subArticle.childSnelstartId,
          childArtikelcode: subArticle.childArtikelcode,
          quantityPerParent,
          ...(child?.inkoopprijs !== undefined && child.inkoopprijs !== null && { inkoopprijs: child.inkoopprijs }),
          ...(child?.eenheid && { eenheid: child.eenheid }),
          ...(child?.voorraad !== undefined && child.voorraad !== null && { voorraad: child.voorraad }),
        });
      }
    }

    return trustedItems;
  }

  async getOrderById(id: string, user?: any) {
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    this.assertCanAccessOrder(order, user);
    return order;
  }

  /**
   * Reorder: build a current-cart snapshot from a past order.
   * - Validates customer access (404 if not own order for customers).
   * - Skips inactive products / inactive categories.
   * - Recalculates unit prices using ProductsService.getProductById
   *   (which applies current pricing rules + customer overrides).
   * - Rebuilds recipe child items from current product definition.
   * - Returns: items (parent-only, for cart add), skipped[], updatedPrices[].
   */
  async reorderOrder(id: string, user?: any) {
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    this.assertCanAccessOrder(order, user);

    const customerId = order.customerId;
    const parentItems = (order.items || []).filter(
      (item: any) => item?.isChildItem !== true,
    );

    const items: any[] = [];
    const skipped: Array<{
      productId?: string;
      productName?: string;
      sku?: string;
      quantity?: number;
      reason: 'product_inactive' | 'product_not_found' | 'category_inactive' | 'price_invalid';
    }> = [];
    const priceUpdates: Array<{
      productId: string;
      productName: string;
      oldUnitPrice: number;
      newUnitPrice: number;
    }> = [];
    let activeCategoryIds: Set<string> | null = null;
    let priceChangedCount = 0;

    for (const originalItem of parentItems) {
      const productId = String(originalItem.productId || '').trim();
      if (!productId) {
        skipped.push({
          productId: originalItem.productId,
          productName: originalItem.productName,
          sku: originalItem.sku,
          quantity: originalItem.quantity,
          reason: 'product_not_found',
        });
        continue;
      }

      let freshProduct: any;
      try {
        freshProduct = await this.productsService.getProductById(
          productId,
          customerId,
          true, // enforceActive: rejects inactive product / inactive category
        );
      } catch (error: any) {
        const reason: 'product_not_found' | 'product_inactive' =
          error instanceof NotFoundException ? 'product_not_found' : 'product_not_found';
        skipped.push({
          productId,
          productName: originalItem.productName,
          sku: originalItem.sku,
          quantity: originalItem.quantity,
          reason,
        });
        continue;
      }

      if (!freshProduct) {
        skipped.push({
          productId,
          productName: originalItem.productName,
          sku: originalItem.sku,
          quantity: originalItem.quantity,
          reason: 'product_not_found',
        });
        continue;
      }

      // Defense in depth: explicit isActive + category active check.
      if (freshProduct.isActive === false) {
        skipped.push({
          productId,
          productName: freshProduct.omschrijving || originalItem.productName,
          sku: freshProduct.artikelnummer || originalItem.sku,
          quantity: originalItem.quantity,
          reason: 'product_inactive',
        });
        continue;
      }

      const productCategoryId =
        freshProduct.artikelomzetgroepId ||
        freshProduct.artikelOmzetgroep?.id ||
        freshProduct.artikelgroepId;
      if (productCategoryId) {
        if (!activeCategoryIds) {
          const ids = await this.categoriesService.getActiveCategoryIds();
          activeCategoryIds = new Set(ids);
        }
        if (!activeCategoryIds.has(productCategoryId)) {
          skipped.push({
            productId,
            productName: freshProduct.omschrijving || originalItem.productName,
            sku: freshProduct.artikelnummer || originalItem.sku,
            quantity: originalItem.quantity,
            reason: 'category_inactive',
          });
          continue;
        }
      }

      const basePrice = Number(freshProduct.basePrice ?? freshProduct.verkoopprijs ?? 0);
      const finalPrice = Number(freshProduct.finalPrice ?? basePrice);
      if (!Number.isFinite(finalPrice) || finalPrice < 0) {
        skipped.push({
          productId,
          productName: freshProduct.omschrijving || originalItem.productName,
          sku: freshProduct.artikelnummer || originalItem.sku,
          quantity: originalItem.quantity,
          reason: 'price_invalid',
        });
        continue;
      }

      const vatRate = this.getVatRate(freshProduct);
      const quantity = this.positiveNumber(originalItem.quantity, 1);
      const oldUnitPrice = Number(originalItem.unitPrice ?? originalItem.basePrice ?? 0);
      if (Number.isFinite(oldUnitPrice) && this.money(oldUnitPrice) !== this.money(finalPrice)) {
        priceChangedCount += 1;
        priceUpdates.push({
          productId,
          productName: freshProduct.omschrijving || originalItem.productName || '',
          oldUnitPrice: this.money(oldUnitPrice),
          newUnitPrice: this.money(finalPrice),
        });
      }

      // Frontend cart-friendly snapshot (parent only — children are computed by cart store from subArticles).
      items.push({
        productId: freshProduct.id || productId,
        productName: freshProduct.omschrijving,
        sku: freshProduct.artikelnummer || freshProduct.artikelcode || '',
        categoryId: productCategoryId,
        quantity,
        unitPrice: this.money(finalPrice),
        unitPriceExclVat: this.money(finalPrice),
        basePrice: this.money(basePrice),
        totalPrice: this.money(finalPrice * quantity),
        vatPercentage: vatRate,
        vatType: freshProduct.vatType ?? null,
        vatRate,
        vatGroupId: freshProduct.vatGroupId,
        vatGroupName: freshProduct.vatGroupName,
        inkoopprijs: freshProduct.inkoopprijs,
        eenheid: freshProduct.eenheid,
        coverImageUrl: freshProduct.coverImageUrl ?? null,
        voorraad: freshProduct.voorraad,
        isParentArticle: freshProduct.isParentArticle === true,
        subArticles: Array.isArray(freshProduct.subArticles) ? freshProduct.subArticles : [],
        lineType: 'product',
      });
    }

    await this.auditService.log({
      action: 'ORDER_REORDER_PREVIEW',
      entityType: 'LocalOrder',
      entityId: order._id.toString(),
      userId: user?.userId,
      actorRole: user?.role,
      metadata: {
        customerId,
        sourceOrderId: order._id.toString(),
        sourceOrderNumber: order.orderNumber,
        itemCount: items.length,
        skippedCount: skipped.length,
        priceChangedCount,
      },
    });

    return {
      sourceOrderId: order._id.toString(),
      sourceOrderNumber: order.orderNumber,
      customerId,
      items,
      skipped,
      priceUpdates,
      stats: {
        totalSourceItems: parentItems.length,
        addedCount: items.length,
        skippedCount: skipped.length,
        priceChangedCount,
      },
    };
  }

  async retryOrder(orderId: string, user?: any) {
    this.assertManageOrderAccess(user);
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'SYNCED') {
      throw new Error('Order already synced');
    }

    order.status = 'PENDING_SYNC';
    order.retryCount = 0;
    await order.save();

    await this.orderSyncQueue.add(
      'sync-order',
      { orderId: order._id.toString() },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    await this.auditService.log({
      action: 'ORDER_RETRY',
      entityType: 'LocalOrder',
      entityId: orderId,
      userId: user?.userId,
      actorRole: user?.role,
    });

    return order;
  }

  async syncOrderToSnelStart(orderId: string): Promise<void> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'SYNCED') {
      return;
    }

    try {
      const createdAt: Date = (order as any).createdAt || new Date();
      const snelStartPayload = this.buildSnelStartPayload(order, createdAt);

      const snelStartOrder = await this.snelStartService.createSalesOrder(snelStartPayload);

      order.status = 'SYNCED';
      order.snelstartOrderId = snelStartOrder.id;
      order.syncedAt = new Date();
      order.errorMessage = undefined;
      await order.save();
    } catch (error: any) {
      order.retryCount += 1;
      order.errorMessage = error.message;

      if (order.retryCount >= 5) {
        order.status = 'FAILED';
      }

      await order.save();
      throw error;
    }
  }

  async deleteOrder(id: string, user?: any) {
    this.assertManageOrderAccess(user);
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new Error('Order not found');
    }

    // Check if order is synced to SnelStart
    if (order.snelstartOrderId) {
      try {
        // Fetch orders from SnelStart for this customer to check procesStatus
        const snelStartOrders = await this.snelStartService.getSalesOrders(order.customerId);
        const snelStartOrder = snelStartOrders.find((o: any) => o.id === order.snelstartOrderId);
        
        if (snelStartOrder && snelStartOrder.procesStatus === 'Factuur') {
          throw new Error('Faturalanmış siparişler silinemez');
        }
      } catch (error: any) {
        if (error.message === 'Faturalanmış siparişler silinemez') {
          throw error;
        }
        // If we can't fetch from SnelStart, still allow deletion of local order
        this.logger.warn(`Could not fetch SnelStart order ${order.snelstartOrderId}, allowing local deletion`);
      }
    }

    await this.orderModel.findByIdAndDelete(id).exec();

    await this.auditService.log({
      action: 'ORDER_DELETED',
      entityType: 'LocalOrder',
      entityId: id,
      userId: user?.userId,
      actorRole: user?.role,
    });

    return { success: true };
  }

  async updateOrder(id: string, orderData: any, user?: any) {
    this.assertManageOrderAccess(user);
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new Error('Order not found');
    }

    // Check if order is synced to SnelStart
    if (order.snelstartOrderId) {
      try {
        // Fetch orders from SnelStart for this customer to check procesStatus
        const snelStartOrders = await this.snelStartService.getSalesOrders(order.customerId);
        const snelStartOrder = snelStartOrders.find((o: any) => o.id === order.snelstartOrderId);
        
        if (snelStartOrder && snelStartOrder.procesStatus === 'Factuur') {
          throw new Error('Faturalanmış siparişler düzenlenemez');
        }
      } catch (error: any) {
        if (error.message === 'Faturalanmış siparişler düzenlenemez') {
          throw error;
        }
        // If we can't fetch from SnelStart, still allow update
        this.logger.warn(`Could not fetch SnelStart order ${order.snelstartOrderId}, allowing local update`);
      }
    }

    const safeOrderData = this.stripProtectedOrderFields(orderData);

    // Update order fields
    if (safeOrderData.items) {
      await this.validateOrderPrices(safeOrderData.items, user);
      const totals = this.calculateOrderTotals(safeOrderData.items);
      safeOrderData.items = totals.items;
      safeOrderData.subtotal = totals.subtotalExclVat;
      safeOrderData.total = totals.totalInclVat;
      safeOrderData.subtotalExclVat = totals.subtotalExclVat;
      safeOrderData.vatAmount = totals.vatAmount;
      safeOrderData.vatTotal = totals.vatTotal;
      safeOrderData.totalInclVat = totals.totalInclVat;
      safeOrderData.vatBreakdown = totals.vatBreakdown;
    }

    Object.assign(order, safeOrderData);
    await order.save();

    await this.auditService.log({
      action: 'ORDER_UPDATED',
      entityType: 'LocalOrder',
      entityId: id,
      userId: user?.userId,
      actorRole: user?.role,
    });

    return order;
  }

  async getUpcomingOrders(filters: Record<string, any> = {}, user?: any) {
    if (user?.role === 'customer') {
      throw new ForbiddenException('Erişim reddedildi');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query: FilterQuery<LocalOrderDocument> = {
      deliveryTiming: 'scheduled',
      deliveryDate: { $gt: today },
    };

    if (user?.role === 'sales_rep') {
      query.createdByUserId = user.userId;
    }

    // Quick filter overrides date range
    if (filters.quickFilter) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      switch (filters.quickFilter) {
        case 'tomorrow':
          query.deliveryDate = { $gte: tomorrow, $lt: dayAfterTomorrow };
          break;
        case 'next3days': {
          const end3 = new Date(today);
          end3.setDate(end3.getDate() + 4);
          query.deliveryDate = { $gt: today, $lt: end3 };
          break;
        }
        case 'next7days': {
          const end7 = new Date(today);
          end7.setDate(end7.getDate() + 8);
          query.deliveryDate = { $gt: today, $lt: end7 };
          break;
        }
        case 'thisweek': {
          const endOfWeek = new Date(today);
          const daysUntilSunday = 7 - today.getDay();
          endOfWeek.setDate(today.getDate() + daysUntilSunday);
          endOfWeek.setHours(23, 59, 59, 999);
          query.deliveryDate = { $gt: today, $lte: endOfWeek };
          break;
        }
      }
    } else {
      if (filters.deliveryDateFrom) {
        const from = this.parseDateBoundary(filters.deliveryDateFrom, 'start');
        if (from && from > today) {
          (query.deliveryDate as any).$gte = from;
        }
      }
      if (filters.deliveryDateTo) {
        const to = this.parseDateBoundary(filters.deliveryDateTo, 'end');
        if (to) {
          (query.deliveryDate as any).$lte = to;
        }
      }
    }

    if (filters.customerId) query.customerId = String(filters.customerId);
    if (filters.deliveryType) query.deliveryType = String(filters.deliveryType);
    if (filters.status) query.status = String(filters.status);

    if (filters.search) {
      const term = String(filters.search).trim();
      if (term) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        query.$or = [{ orderNumber: regex }, { 'items.productName': regex }];
      }
    }

    const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
    const page = Math.max(Number(filters.page) || 1, 1);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.orderModel.find(query).sort({ deliveryDate: 1 }).skip(skip).limit(limit).lean().exec(),
      this.orderModel.countDocuments(query),
    ]);

    const todayMs = today.getTime();
    const enriched = data.map((order: any) => ({
      ...order,
      daysUntilDelivery: order.deliveryDate
        ? Math.ceil((new Date(order.deliveryDate).getTime() - todayMs) / (1000 * 60 * 60 * 24))
        : null,
    }));

    return {
      data: enriched,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        hasNext: skip + enriched.length < total,
        hasPrev: page > 1,
      },
    };
  }

  async getDashboardStats(period: 'daily' | 'weekly' | 'monthly' = 'daily', user?: any) {
    if (user?.role === 'customer') {
      throw new ForbiddenException('Dashboard erişimi yok');
    }
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    // Get orders in period
    const orders = await this.orderModel
      .find({
        createdAt: { $gte: startDate },
      })
      .sort({ createdAt: -1 })
      .exec();

    // Get visited and planned customers from visit status
    const visitedCustomers = await this.customersService.getVisitedCustomers(period);
    const plannedCustomers = await this.customersService.getPlannedCustomers();

    // Group orders by customer
    const ordersByCustomer = orders.reduce((acc: any, order) => {
      if (!acc[order.customerId]) {
        acc[order.customerId] = {
          customerId: order.customerId,
          count: 0,
          total: 0,
        };
      }
      acc[order.customerId].count += 1;
      acc[order.customerId].total += order.total || 0;
      return acc;
    }, {});

    // Get customer names
    const allCustomers = await this.snelStartService.getCustomers();
    const customerMap = new Map(allCustomers.map((c: any) => [c.id, c]));
    const ordersByCustomerList = Object.values(ordersByCustomer).map((item: any) => ({
      ...item,
      customerName: (customerMap.get(item.customerId) as any)?.naam || 'Bilinmeyen Müşteri',
    }));

    // Get top products
    const productCounts: Record<string, { productId: string; productName: string; count: number; totalQuantity: number }> = {};
    orders.forEach((order) => {
      order.items.forEach((item: any) => {
        if (!productCounts[item.productId]) {
          productCounts[item.productId] = {
            productId: item.productId,
            productName: item.productName || 'Bilinmeyen Ürün',
            count: 0,
            totalQuantity: 0,
          };
        }
        productCounts[item.productId].count += 1;
        productCounts[item.productId].totalQuantity += item.quantity;
      });
    });

    const topProducts = Object.values(productCounts)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10);

    // Upcoming order counts for dashboard widgets
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrowStart);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    const next7DaysEnd = new Date(todayStart);
    next7DaysEnd.setDate(next7DaysEnd.getDate() + 8);

    const [todayScheduledCount, tomorrowCount, next7DaysCount, overdueCount] = await Promise.all([
      this.orderModel.countDocuments({
        deliveryTiming: 'scheduled',
        deliveryDate: { $gte: todayStart, $lt: tomorrowStart },
      }),
      this.orderModel.countDocuments({
        deliveryTiming: 'scheduled',
        deliveryDate: { $gte: tomorrowStart, $lt: dayAfterTomorrow },
      }),
      this.orderModel.countDocuments({
        deliveryTiming: 'scheduled',
        deliveryDate: { $gt: todayStart, $lt: next7DaysEnd },
      }),
      this.orderModel.countDocuments({
        deliveryTiming: 'scheduled',
        deliveryDate: { $lt: todayStart },
        status: { $ne: 'SYNCED' },
      }),
    ]);

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      visitedCustomers: visitedCustomers.slice(0, 50), // Limit to 50
      plannedCustomers: plannedCustomers.slice(0, 50), // Limit to 50
      ordersByCustomer: ordersByCustomerList.sort((a: any, b: any) => b.count - a.count),
      topProducts,
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + (o.total || 0), 0),
      upcoming: {
        todayScheduled: todayScheduledCount,
        tomorrow: tomorrowCount,
        next7Days: next7DaysCount,
        overdue: overdueCount,
      },
    };
  }

  private resolveOrderCustomerId(requestedCustomerId: string, user?: any): string {
    if (user?.role === 'customer') {
      return this.requireCustomerId(user);
    }
    return requestedCustomerId;
  }

  private stripProtectedOrderFields(orderData: any) {
    const {
      createdByUserId: _createdByUserId,
      createdByUsername: _createdByUsername,
      createdByFullName: _createdByFullName,
      createdByRole: _createdByRole,
      createdByCustomerId: _createdByCustomerId,
      createdByCustomerName: _createdByCustomerName,
      ...safeOrderData
    } = orderData || {};
    return safeOrderData;
  }

  private requireCustomerId(user?: any): string {
    const customerId = String(user?.customerId || '').trim();
    if (!customerId) {
      throw new ForbiddenException('Customer kullanıcı müşteri kaydına bağlı değil');
    }
    return customerId;
  }

  private requireCustomerUserId(user?: any): string {
    const userId = String(user?.userId || '').trim();
    if (!userId) {
      throw new ForbiddenException('Customer kullanıcı kimliği doğrulanamadı');
    }
    return userId;
  }

  private assertCanAccessOrder(order: LocalOrderDocument, user?: any) {
    if (user?.role !== 'customer') {
      return;
    }
    const userId = this.requireCustomerUserId(user);
    if (order.customerId !== this.requireCustomerId(user) || order.createdByUserId !== userId) {
      throw new NotFoundException('Order not found');
    }
  }

  private assertManageOrderAccess(user?: any) {
    if (user?.role === 'customer') {
      throw new ForbiddenException('Customer kullanıcı sipariş yönetimi yapamaz');
    }
  }

  private async notifyOrderCreated(order: LocalOrderDocument, user: any, customerId: string) {
    let success = false;
    try {
      const customer = await this.customersService.getCustomerById(customerId);
      success = this.orderNotificationService
        ? await this.orderNotificationService.sendOrderCreatedNotification(order, user, customer)
        : false;
    } catch (error: any) {
      this.logger.error(`Order notification email failed: ${error?.message || error}`);
    } finally {
      await this.auditService.log({
        action: success ? 'ORDER_NOTIFICATION_EMAIL_SENT' : 'ORDER_NOTIFICATION_EMAIL_FAILED',
        entityType: 'LocalOrder',
        entityId: order._id.toString(),
        userId: user?.userId,
        actorRole: user?.role,
        metadata: { customerId },
      });
    }
  }
}
