import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationType =
  | 'new_order'
  | 'upcoming_reminder'
  | 'order_cancelled'
  | 'order_updated'
  | 'system';

@Schema({ timestamps: true })
export class Notification extends Document {
  @Prop({
    required: true,
    enum: ['new_order', 'upcoming_reminder', 'order_cancelled', 'order_updated', 'system'],
  })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ type: Date })
  targetDate?: Date;

  @Prop()
  relatedOrderId?: string;

  @Prop()
  relatedOrderNumber?: string;

  @Prop({ type: [String], required: true })
  targetRoles: string[];

  @Prop()
  targetUserId?: string;

  // Dedup key for reminders: "orderId:YYYY-MM-DD"
  @Prop()
  reminderKey?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
export type NotificationDocument = Notification & Document;

NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ targetRoles: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ targetUserId: 1, createdAt: -1 });
NotificationSchema.index({ reminderKey: 1 }, { unique: true, sparse: true });
