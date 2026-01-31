import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class PriceOverrideRule extends Document {
  @Prop({ required: true })
  type: string;

  @Prop()
  productId?: string;

  @Prop()
  categoryId?: string;

  @Prop()
  customerId?: string;

  @Prop()
  fixedPrice?: number;

  @Prop()
  discountPercent?: number;

  @Prop({ required: true })
  priority: number;

  @Prop({ required: true })
  validFrom: Date;

  @Prop()
  validTo?: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const PriceOverrideRuleSchema = SchemaFactory.createForClass(PriceOverrideRule);
export type PriceOverrideRuleDocument = PriceOverrideRule & Document;

