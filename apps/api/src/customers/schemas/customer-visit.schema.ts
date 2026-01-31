import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class CustomerVisit extends Document {
  @Prop({ required: true, unique: true })
  customerId: string;

  @Prop({ enum: ['VISITED', 'PLANNED'], default: null })
  status: 'VISITED' | 'PLANNED' | null;

  @Prop()
  visitedAt?: Date;

  @Prop()
  plannedAt?: Date;

  @Prop()
  notes?: string;
}

export const CustomerVisitSchema = SchemaFactory.createForClass(CustomerVisit);
export type CustomerVisitDocument = CustomerVisit & Document;

