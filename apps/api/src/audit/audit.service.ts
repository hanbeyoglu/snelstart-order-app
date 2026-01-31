import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

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
    const log = new this.auditLogModel(data);
    await log.save();
  }

  async getLogs(filters?: any) {
    return this.auditLogModel.find(filters || {}).sort({ createdAt: -1 }).exec();
  }
}

