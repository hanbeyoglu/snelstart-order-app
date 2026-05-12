import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './schemas/notification.schema';
import { LocalOrder, LocalOrderDocument } from '../orders/schemas/local-order.schema';

interface CreateNotificationDto {
  type: NotificationType;
  title: string;
  message: string;
  targetRoles: string[];
  targetUserId?: string;
  relatedOrderId?: string;
  relatedOrderNumber?: string;
  targetDate?: Date;
  reminderKey?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectModel(LocalOrder.name) private orderModel: Model<LocalOrderDocument>,
  ) {}

  onModuleInit() {
    this.scheduleUpcomingReminders();
  }

  private scheduleUpcomingReminders() {
    const now = new Date();
    const next8am = new Date(now);
    next8am.setHours(8, 0, 0, 0);
    if (next8am <= now) {
      next8am.setDate(next8am.getDate() + 1);
    }

    const msUntil8am = next8am.getTime() - now.getTime();

    setTimeout(() => {
      void this.processUpcomingReminders();
      setInterval(() => {
        void this.processUpcomingReminders();
      }, 24 * 60 * 60 * 1000);
    }, msUntil8am);

    this.logger.log(
      `Upcoming reminder scheduler initialized. Next run in ${Math.round(msUntil8am / 60000)} minutes.`,
    );
  }

  async createNotification(dto: CreateNotificationDto): Promise<NotificationDocument> {
    const notification = new this.notificationModel(dto);
    return notification.save();
  }

  async createOrderNotification(order: any, user?: any): Promise<void> {
    try {
      const isScheduled =
        order.deliveryTiming === 'scheduled' && order.deliveryDate;
      const deliveryDateStr = isScheduled
        ? new Date(order.deliveryDate).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
        : null;

      const orderRef = order.orderNumber || String(order._id).slice(-8).toUpperCase();
      const title = `Yeni sipariş: #${orderRef}`;
      const messageParts: string[] = [];

      if (order.customerId) messageParts.push(`Müşteri: ${order.customerId}`);
      if (isScheduled && deliveryDateStr) {
        messageParts.push(`Teslim tarihi: ${deliveryDateStr}`);
      } else if (order.deliveryTiming === 'asap') {
        messageParts.push('Hemen teslimat');
      }
      if (order.totalInclVat) {
        messageParts.push(`Tutar: €${Number(order.totalInclVat).toFixed(2)}`);
      }

      const targetRoles: string[] = ['admin', 'super_admin'];
      const createdByRole = order.createdByRole || user?.role;
      const createdByUserId = order.createdByUserId || user?.userId;

      if (createdByRole === 'sales_rep' && createdByUserId) {
        targetRoles.push('sales_rep');
      }

      await this.createNotification({
        type: 'new_order',
        title,
        message: messageParts.join(' • '),
        targetRoles,
        targetUserId: createdByRole === 'sales_rep' ? createdByUserId : undefined,
        relatedOrderId: String(order._id),
        relatedOrderNumber: order.orderNumber,
        targetDate: order.deliveryDate ? new Date(order.deliveryDate) : undefined,
        metadata: {
          customerId: order.customerId,
          total: order.totalInclVat,
          deliveryType: order.deliveryType,
          deliveryTiming: order.deliveryTiming,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to create order notification: ${err?.message}`);
    }
  }

  async processUpcomingReminders(): Promise<void> {
    this.logger.log('Processing upcoming order reminders...');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const upcomingOrders = await this.orderModel
        .find({
          deliveryTiming: 'scheduled',
          deliveryDate: { $gte: tomorrow, $lt: dayAfterTomorrow },
          status: { $ne: 'FAILED' },
        })
        .lean()
        .exec();

      this.logger.log(`Found ${upcomingOrders.length} orders for tomorrow (${tomorrowStr})`);

      for (const order of upcomingOrders) {
        const reminderKey = `${String(order._id)}:${tomorrowStr}`;
        const exists = await this.notificationModel.findOne({ reminderKey }).lean().exec();
        if (exists) continue;

        const orderRef = (order as any).orderNumber || String(order._id).slice(-8).toUpperCase();
        const dateLabel = tomorrow.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

        const targetRoles: string[] = ['admin', 'super_admin'];
        const createdByRole = (order as any).createdByRole;
        const createdByUserId = (order as any).createdByUserId;

        if (createdByRole === 'sales_rep' && createdByUserId) {
          targetRoles.push('sales_rep');
        }

        await this.createNotification({
          type: 'upcoming_reminder',
          title: `Yarın teslim: #${orderRef}`,
          message: `${dateLabel} tarihinde teslim edilecek sipariş mevcut.`,
          targetRoles,
          targetUserId: createdByRole === 'sales_rep' ? createdByUserId : undefined,
          relatedOrderId: String(order._id),
          relatedOrderNumber: (order as any).orderNumber,
          targetDate: tomorrow,
          reminderKey,
          metadata: {
            customerId: (order as any).customerId,
            total: (order as any).totalInclVat,
          },
        });

        this.logger.log(`Created reminder for order #${orderRef}`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to process upcoming reminders: ${err?.message}`);
    }
  }

  private buildQueryForUser(user: any): FilterQuery<NotificationDocument> {
    const role = user?.role;

    if (role === 'super_admin') {
      return {};
    }

    if (role === 'admin') {
      return { targetRoles: role };
    }

    if (role === 'sales_rep') {
      return {
        targetRoles: 'sales_rep',
        $or: [
          { targetUserId: { $exists: false } },
          { targetUserId: null },
          { targetUserId: user.userId },
        ],
      };
    }

    // Customers and unknown roles see nothing
    return { _id: null };
  }

  async getNotifications(
    user: any,
    page = 1,
    limit = 20,
  ): Promise<{ data: NotificationDocument[]; total: number; unreadCount: number }> {
    const query = this.buildQueryForUser(user);
    const skip = (page - 1) * limit;

    const [data, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.notificationModel.countDocuments(query),
      this.notificationModel.countDocuments({ ...query, isRead: false }),
    ]);

    return { data: data as any, total, unreadCount };
  }

  async getUnreadCount(user: any): Promise<number> {
    const query = this.buildQueryForUser(user);
    return this.notificationModel.countDocuments({ ...query, isRead: false });
  }

  async markAsRead(id: string, user: any): Promise<void> {
    const query = this.buildQueryForUser(user);
    await this.notificationModel.updateOne({ _id: id, ...query }, { isRead: true }).exec();
  }

  async markAllAsRead(user: any): Promise<void> {
    const query = this.buildQueryForUser(user);
    await this.notificationModel.updateMany({ ...query, isRead: false }, { isRead: true }).exec();
  }
}
