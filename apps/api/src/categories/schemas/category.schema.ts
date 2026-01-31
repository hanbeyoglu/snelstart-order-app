import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Category extends Document {
  @Prop({ required: true, unique: true })
  snelstartId: string; // artikelomzetgroep ID

  @Prop({ required: true })
  nummer: number;

  @Prop({ required: true })
  omschrijving: string;

  @Prop()
  verkoopNederlandBtwSoort?: string;

  @Prop({
    type: {
      id: String,
      uri: String,
    },
    _id: false,
  })
  verkoopGrootboekNederlandIdentifier?: {
    id: string;
    uri: string;
  };

  @Prop()
  uri?: string;

  @Prop({ default: Date.now })
  lastSyncedAt: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
export type CategoryDocument = Category & Document;
