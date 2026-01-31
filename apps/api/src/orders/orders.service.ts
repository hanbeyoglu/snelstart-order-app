import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LocalOrder, LocalOrderDocument } from './schemas/local-order.schema';
import { SnelStartService } from '../snelstart/snelstart.service';
import { AuditService } from '../audit/audit.service';
import { CustomersService } from '../customers/customers.service';
import { createOrderSchema } from '@snelstart-order-app/shared';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(LocalOrder.name) private orderModel: Model<LocalOrderDocument>,
    @InjectQueue('order-sync') private orderSyncQueue: Queue,
    private snelStartService: SnelStartService,
    private auditService: AuditService,
    @Inject(forwardRef(() => CustomersService)) private customersService: CustomersService,
  ) {}

  async createOrder(orderData: any, userId?: string) {
    const validated = createOrderSchema.parse(orderData);

    // Check idempotency
    const existing = await this.orderModel
      .findOne({ idempotencyKey: validated.idempotencyKey })
      .exec();
    if (existing) {
      return existing;
    }

    // Calculate subtotal and total from items
    const subtotal = validated.items.reduce((sum, item) => {
      return sum + (item.unitPrice * item.quantity);
    }, 0);
    const total = subtotal; // VAT is already included in unitPrice or handled separately

    // Create local order
    const order = new this.orderModel({
      ...validated,
      subtotal,
      total,
      status: 'PENDING_SYNC',
    });
    await order.save();

    // Try to sync immediately
    try {
      // SnelStart sipariş formatını oluştur
      const today = new Date();
      const dateOnly = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      ).toISOString().split('T')[0];

      const snelStartPayload: any = {
        relatie: {
          id: validated.customerId,
        },
        datum: `${dateOnly}T00:00:00`,
        verkooporderBtwIngaveModel: 'Exclusief',
        regels: validated.items.map((item) => ({
          artikel: {
            id: item.productId,
          },
          aantal: item.quantity,
          stuksprijs: item.unitPrice,
        })),
        memo: 'Özel yazılımdan gelen sipariş',
      };

      const snelStartOrder = await this.snelStartService.createSalesOrder(snelStartPayload);

      order.status = 'SYNCED';
      order.snelstartOrderId = snelStartOrder.id;
      order.syncedAt = new Date();
      await order.save();

      await this.auditService.log({
        action: 'ORDER_SYNCED',
        entityType: 'LocalOrder',
        entityId: order._id.toString(),
        userId,
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
        userId,
        metadata: { error: error.message },
      });

      return order;
    }
  }

  async getOrders(filters?: any) {
    return this.orderModel.find(filters || {}).sort({ createdAt: -1 }).exec();
  }

  async getOrderById(id: string) {
    return this.orderModel.findById(id).exec();
  }

  async retryOrder(orderId: string, userId?: string) {
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
      userId,
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
      const dateOnly = new Date(
        createdAt.getFullYear(),
        createdAt.getMonth(),
        createdAt.getDate(),
      ).toISOString().split('T')[0];

      const snelStartPayload: any = {
        relatie: {
          id: order.customerId,
        },
        datum: `${dateOnly}T00:00:00`,
        verkooporderBtwIngaveModel: 'Exclusief',
        regels: order.items.map((item: any) => ({
          artikel: {
            id: item.productId,
          },
          aantal: item.quantity,
          stuksprijs: item.unitPrice,
        })),
        memo: 'Özel yazılımdan gelen sipariş',
      };

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

  async deleteOrder(id: string, userId?: string) {
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
      userId,
    });

    return { success: true };
  }

  async updateOrder(id: string, orderData: any, userId?: string) {
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

    // Update order fields
    if (orderData.items) {
      const subtotal = orderData.items.reduce((sum: number, item: any) => {
        return sum + (item.unitPrice * item.quantity);
      }, 0);
      orderData.subtotal = subtotal;
      orderData.total = subtotal;
    }

    Object.assign(order, orderData);
    await order.save();

    await this.auditService.log({
      action: 'ORDER_UPDATED',
      entityType: 'LocalOrder',
      entityId: id,
      userId,
    });

    return order;
  }

  async getDashboardStats(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
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
}

