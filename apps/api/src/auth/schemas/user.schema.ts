import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: false })
  email?: string;

  @Prop({ required: false })
  firstName?: string;

  @Prop({ required: false })
  lastName?: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: ['admin', 'sales_rep'], default: 'sales_rep' })
  role: 'admin' | 'sales_rep';
}

export const UserSchema = SchemaFactory.createForClass(User);

// Remove any existing email index first (if exists)
// Then create partial unique index: only index email when it's a string
// This allows multiple users without email (null/undefined values are not indexed)
UserSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string' } },
    name: 'email_unique_partial',
  }
);

export type UserDocument = User & Document;

