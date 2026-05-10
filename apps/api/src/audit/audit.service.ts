import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';

const SENSITIVE_KEY_PATTERN = /password|secret|token|key|authorization|credential/i;
const FAILED_ACTION_PATTERN = /FAILED|FAILURE|BLOCKED|DENIED|REJECTED|ERROR/i;
const CRITICAL_ACTION_PATTERN =
  /ROLE|PERMISSION|USER_DELETED|SNELSTART_SETTINGS|SNELSTART_TOKEN|TOKEN_REFRESH|PRICE_OVERRIDE|PRICE_RULE|VISIBILITY/i;
const CRITICAL_ENTITY_PATTERN = /ConnectionSettings|PriceOverrideRule/i;

type AuditFilters = {
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  critical?: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
};

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async log(data: {
    action: string;
    entityType: string;
    entityId: string;
    userId?: string;
    ip?: string;
    userAgent?: string;
    changes?: Record<string, any>;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const log = new this.auditLogModel({
        ...data,
        changes: this.redact(data.changes),
        metadata: this.redact(data.metadata),
      });
      await log.save();
    } catch (error) {
      console.error('[AuditService] Failed to write audit log:', error);
    }
  }

  requestContext(req?: any) {
    if (!req) return {};
    return {
      ip: req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    };
  }

  async getLogs(filters?: AuditFilters) {
    const page = Math.max(1, Number(filters?.page || 1));
    const limit = Math.min(Math.max(1, Number(filters?.limit || 50)), 200);
    const query = this.buildQuery(filters);

    if (filters?.critical === 'true') {
      query.$and = [...(query.$and || []), this.criticalQuery()];
    }
    if (filters?.critical === 'false') {
      query.$and = [...(query.$and || []), { $nor: [this.criticalQuery()] }];
    }
    if (filters?.status) {
      query.$and = [...(query.$and || []), this.statusQuery(filters.status)];
    }

    const [data, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.auditLogModel.countDocuments(query).exec(),
    ]);

    const enrichedData = await this.enrichLogs(data);

    return {
      data: enrichedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStats(filters?: Pick<AuditFilters, 'startDate' | 'endDate'>) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const last7Start = new Date(now);
    last7Start.setDate(last7Start.getDate() - 6);
    last7Start.setHours(0, 0, 0, 0);
    const scopedQuery = this.buildQuery(filters);

    const [totalToday, totalLast7Days, criticalCount, failedCount, actionDistribution, dailyTrend, actorDistribution] =
      await Promise.all([
        this.auditLogModel.countDocuments({ createdAt: { $gte: todayStart } }).exec(),
        this.auditLogModel.countDocuments({ createdAt: { $gte: last7Start } }).exec(),
        this.auditLogModel.countDocuments({ $and: [scopedQuery, this.criticalQuery()] }).exec(),
        this.auditLogModel.countDocuments({ $and: [scopedQuery, this.statusQuery('failed')] }).exec(),
        this.auditLogModel.aggregate([
          { $match: scopedQuery },
          { $group: { _id: '$action', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
          { $project: { _id: 0, action: '$_id', count: 1 } },
        ]),
        this.auditLogModel.aggregate([
          { $match: { ...scopedQuery, createdAt: { ...(scopedQuery.createdAt || {}), $gte: last7Start } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, date: '$_id', count: 1 } },
        ]),
        this.auditLogModel.aggregate([
          { $match: scopedQuery },
          { $group: { _id: '$userId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 },
          { $project: { _id: 0, userId: '$_id', count: 1 } },
        ]),
      ]);

    const userMap = await this.getUserMap(actorDistribution.map((item) => item.userId).filter(Boolean));
    const actorDistributionWithNames = actorDistribution.map((item) => ({
      ...item,
      actor: this.formatActor(userMap.get(String(item.userId)), item.userId),
    }));

    return {
      totalToday,
      totalLast7Days,
      topActor: actorDistributionWithNames[0]?.actor || null,
      criticalCount,
      failedCount,
      actionDistribution,
      dailyTrend,
      actorDistribution: actorDistributionWithNames,
    };
  }

  private buildQuery(filters?: Pick<AuditFilters, 'action' | 'entityType' | 'entityId' | 'userId' | 'startDate' | 'endDate' | 'search'>) {
    const query: Record<string, any> = {};

    if (filters?.action) query.action = filters.action;
    if (filters?.entityType) query.entityType = filters.entityType;
    if (filters?.entityId) query.entityId = filters.entityId;
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.startDate || filters?.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }
    if (filters?.search) {
      const regex = new RegExp(this.escapeRegExp(filters.search), 'i');
      query.$or = [
        { action: regex },
        { entityType: regex },
        { entityId: regex },
        { userId: regex },
        { ip: regex },
      ];
    }

    return query;
  }

  private criticalQuery() {
    return {
      $or: [
        { action: CRITICAL_ACTION_PATTERN },
        { entityType: CRITICAL_ENTITY_PATTERN },
      ],
    };
  }

  private statusQuery(status: string) {
    if (status === 'success') {
      return {
        $and: [
          { action: { $not: FAILED_ACTION_PATTERN } },
          { 'metadata.success': { $ne: false } },
          { 'metadata.blocked': { $ne: true } },
        ],
      };
    }

    return {
      $or: [
        { action: FAILED_ACTION_PATTERN },
        { 'metadata.success': false },
        { 'metadata.blocked': true },
      ],
    };
  }

  private async enrichLogs(logs: any[]) {
    const userMap = await this.getUserMap(logs.map((log) => log.userId).filter(Boolean));
    return logs.map((log) => {
      const actor = this.formatActor(userMap.get(String(log.userId)), log.userId);
      return {
        ...log,
        changes: this.redact(log.changes),
        metadata: this.redact(log.metadata),
        actor,
        critical: this.isCritical(log),
        status: this.getStatus(log),
        description: this.describe(log, actor?.displayName),
      };
    });
  }

  private async getUserMap(userIds: string[]) {
    const uniqueIds = [...new Set(userIds.map(String))].filter((id) => Types.ObjectId.isValid(id));
    if (uniqueIds.length === 0) return new Map<string, any>();
    const users = await this.userModel
      .find({ _id: { $in: uniqueIds } })
      .select('username email firstName lastName role')
      .lean()
      .exec();
    return new Map(users.map((user: any) => [String(user._id), user]));
  }

  private formatActor(user?: any, userId?: string) {
    if (!user && !userId) return null;
    const displayName = user
      ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || user.email
      : userId;
    return {
      id: userId || String(user?._id),
      username: user?.username,
      email: user?.email,
      role: user?.role,
      displayName,
    };
  }

  private isCritical(log: any) {
    return CRITICAL_ACTION_PATTERN.test(log.action || '') || CRITICAL_ENTITY_PATTERN.test(log.entityType || '');
  }

  private getStatus(log: any) {
    return FAILED_ACTION_PATTERN.test(log.action || '') || log.metadata?.success === false || log.metadata?.blocked === true
      ? 'failed'
      : 'success';
  }

  private describe(log: any, actorName?: string) {
    const actor = actorName || 'Sistem';
    const descriptions: Record<string, string> = {
      PRODUCT_VISIBILITY_UPDATED: `${actor} ürün görünürlüğünü değiştirdi`,
      CATEGORY_VISIBILITY_UPDATED: `${actor} kategori görünürlüğünü değiştirdi`,
      USER_UPDATED: `${actor} kullanıcı bilgilerini güncelledi`,
      USER_PERMISSIONS_UPDATED: `${actor} kullanıcı izinlerini güncelledi`,
      USER_CREATED: `${actor} yeni kullanıcı oluşturdu`,
      USER_DELETED: `${actor} kullanıcı sildi`,
      SNELSTART_SETTINGS_SAVED: `${actor} SnelStart ayarlarını değiştirdi`,
      SNELSTART_TOKEN_REFRESHED: 'SnelStart token yenilendi',
      PRICE_RULE_CREATED: `${actor} fiyat kuralı oluşturdu`,
      PRICE_RULE_UPDATED: `${actor} fiyat kuralı güncelledi`,
      PRICE_RULE_DELETED: `${actor} fiyat kuralı sildi`,
      ORDER_SYNC_FAILED: `${actor} sipariş senkronizasyonunda hata aldı`,
      ORDER_SYNCED: `${actor} siparişi SnelStart ile senkronize etti`,
    };

    return descriptions[log.action] || `${actor} ${String(log.action || '').toLowerCase().replace(/_/g, ' ')} işlemini yaptı`;
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private redact(value: any): any {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (typeof value !== 'object') return value;

    return Object.entries(value).reduce((acc, [key, child]) => {
      acc[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : this.redact(child);
      return acc;
    }, {} as Record<string, any>);
  }
}
