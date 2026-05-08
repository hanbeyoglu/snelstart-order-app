import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

const SENSITIVE_KEY_PATTERN = /password|secret|token|key|authorization|credential/i;

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) {}

  async log(data: {
    action: string;
    entityType: string;
    entityId: string;
    userId?: string;
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

  async getLogs(filters?: {
    action?: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(filters?.page || 1));
    const limit = Math.min(Math.max(1, Number(filters?.limit || 50)), 200);
    const query: Record<string, any> = {};

    if (filters?.action) query.action = filters.action;
    if (filters?.entityType) query.entityType = filters.entityType;
    if (filters?.entityId) query.entityId = filters.entityId;
    if (filters?.userId) query.userId = filters.userId;

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

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
