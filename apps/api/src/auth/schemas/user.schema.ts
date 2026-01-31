import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: ['admin', 'sales_rep'], default: 'sales_rep' })
  role: 'admin' | 'sales_rep';
}

export const UserSchema = SchemaFactory.createForClass(User);
export type UserDocument = User & Document;

