import { Schema, Document } from 'mongoose';

export interface AuditLog extends Document {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  actorRole?: string;
  targetRole?: string;
  ip?: string;
  userAgent?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export const AuditLogSchema = new Schema<AuditLog>(
  {
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    userId: String,
    actorRole: String,
    targetRole: String,
    ip: String,
    userAgent: String,
    changes: Schema.Types.Mixed,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);
