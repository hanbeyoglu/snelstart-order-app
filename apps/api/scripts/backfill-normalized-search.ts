import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose, { Schema, Types } from 'mongoose';
import { buildNormalizedSearchTextFromProductFields } from '../src/products/normalized-search.util';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const BATCH = 500;

/** Raw Mongo documents; avoid importing Nest Product schema in standalone tooling. */
const productLeanSchema = new Schema(
  {},
  {
    collection: 'products',
    strict: false,
  },
);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const modelName = 'NormalizedSearchBackfillDoc';
  const Product =
    (mongoose.models as Record<string, mongoose.Model<unknown>>)[modelName] ||
    mongoose.model(modelName, productLeanSchema);

  let updated = 0;
  let scanned = 0;
  let lastId: Types.ObjectId | null = null;

  const baseFilter = {
    $or: [
      { normalizedSearchText: { $exists: false } },
      { normalizedSearchText: null },
      { normalizedSearchText: '' },
    ],
  };

  for (;;) {
    const q: Record<string, unknown> = { ...baseFilter };
    if (lastId) {
      q._id = { $gt: lastId };
    }

    const docs = await Product.find(q)
      .sort({ _id: 1 })
      .limit(BATCH)
      .lean()
      .exec();

    if (!docs.length) {
      break;
    }

    const bulkOps: mongoose.mongo.AnyBulkWriteOperation[] = [];

    for (const doc of docs) {
      scanned++;
      const d = doc as Record<string, unknown>;
      const next = buildNormalizedSearchTextFromProductFields({
        omschrijving: d.omschrijving as string | undefined,
        artikelcode: d.artikelcode as string | undefined,
        artikelnummer: d.artikelnummer as string | undefined,
        barcode: d.barcode as string | undefined,
        extraVelden: d.extraVelden,
      });
      const prev = d.normalizedSearchText == null ? '' : String(d.normalizedSearchText);
      if (next !== prev) {
        bulkOps.push({
          updateOne: {
            filter: { _id: (doc as { _id: Types.ObjectId })._id },
            update: { $set: { normalizedSearchText: next } },
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      const res = await Product.bulkWrite(bulkOps, { ordered: false });
      updated += res.modifiedCount;
    }

    lastId = (docs[docs.length - 1] as { _id: Types.ObjectId })._id;

    if (docs.length < BATCH) {
      break;
    }
  }

  console.log(`[backfill-normalized-search] scanned ${scanned} products, updated ${updated} products`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
