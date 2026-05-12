import { BadRequestException, ForbiddenException, Injectable, Inject, forwardRef, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LocalOrder, LocalOrderDocument } from './schemas/local-order.schema';
import { SnelStartService } from '../snelstart/snelstart.service';
import { AuditService } from '../audit/audit.service';
import { CustomersService } from '../customers/customers.service';
import { createOrderSchema } from '@snelstart-order-app/shared';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { ProductsService } from '../products/products.service';
import { parseOrBadRequest } from '../common/validation/zod-validation';
import { OrderNotificationService } from './order-notification.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(LocalOrder.name) private orderModel: Model<LocalOrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectQueue('order-sync') private orderSyncQueue: Queue,
    private snelStartService: SnelStartService,
    private auditService: AuditService,
    @Inject(forwardRef(() => CustomersService)) private customersService: CustomersService,
    private productsService: ProductsService,
    private orderNotificationService?: OrderNotificationService,
  ) {}

  private getMinimumAllowedPrice(basePrice: number, purchasePrice?: number | null) {
    if (purchasePrice && purchasePrice > 0) {
      return purchasePrice * 1.05;
    }
    return basePrice * 0.95;
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
        (order as any).memo || 'Özel yazılımdan gelen sipariş',
        order,
      ),
    };
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
      const unitPrice = item.unitPrice;
      const basePrice = product?.verkoopprijs ?? item.basePrice ?? unitPrice;
      const purchasePrice = product?.inkoopprijs;
      const minPrice = this.getMinimumAllowedPrice(basePrice, purchasePrice);

      if (unitPrice >= minPrice) {
        continue;
      }

      if (!item.adminOverride && !item.adminPriceOverrideConfirmed) {
        throw new BadRequestException('PRICE_BELOW_MINIMUM');
      }

      if (user?.role !== 'admin' && user?.role !== 'super_admin') {
        throw new ForbiddenException('ADMIN_PRICE_OVERRIDE_REQUIRED');
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
    const validated = {
      idempotencyKey: requested.idempotencyKey,
      customerId: effectiveCustomerId,
      memo: requested.memo,
      items: totals.items,
      ...creatorSnapshot,
    };

    // Create local order
    const order = new this.orderModel({
      ...validated,
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

  async getOrders(filters?: any, user?: any) {
    const effectiveFilters = { ...(filters || {}) };
    if (user?.role === 'customer') {
      effectiveFilters.customerId = this.requireCustomerId(user);
      effectiveFilters.createdByUserId = this.requireCustomerUserId(user);
    }
    return this.orderModel.find(effectiveFilters).sort({ createdAt: -1 }).exec();
  }

  private async buildTrustedOrderItems(
    items: Array<any>,
    customerId: string,
    user?: any,
  ) {
    const trustedItems = [];

    for (const item of items.filter((cartItem) => cartItem.isChildItem !== true)) {
      const product: any = await this.productsService.getProductById(item.productId, customerId);
      const basePrice = Number(product.basePrice || product.verkoopprijs || 0);
      const trustedUnitPrice = Number(product.finalPrice ?? basePrice);
      const vatRate = this.getVatRate(product);
      const requestedUnitPrice = Number(item.unitPrice);
      const hasRequestedPrice = Number.isFinite(requestedUnitPrice);
      const priceChanged = hasRequestedPrice && requestedUnitPrice !== trustedUnitPrice;
      const hasAdminOverride =
        item.adminOverride === true ||
        item.adminPriceOverrideConfirmed === true ||
        item.customUnitPrice !== undefined;

      let unitPrice = trustedUnitPrice;
      if (priceChanged) {
        if (user?.role !== 'admin' && user?.role !== 'super_admin') {
          throw new ForbiddenException('ADMIN_PRICE_OVERRIDE_REQUIRED');
        }
        if (!hasAdminOverride) {
          throw new BadRequestException('PRICE_OVERRIDE_CONFIRMATION_REQUIRED');
        }

        const minPrice = this.getMinimumAllowedPrice(basePrice, product.inkoopprijs);
        if (requestedUnitPrice < minPrice && !item.adminPriceOverrideConfirmed) {
          throw new BadRequestException('PRICE_BELOW_MINIMUM');
        }

        unitPrice = requestedUnitPrice;
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
