/* =========================
   ENV BOOTSTRAP (GLOBAL)
   ========================= */
   import * as path from 'path';
   import * as dotenv from 'dotenv';
   
   dotenv.config({
     path: path.resolve(__dirname, '../../../.env'),
   });
   
   /* =========================
      IMPORTS
      ========================= */
   import { Worker } from 'bullmq';
   import mongoose from 'mongoose';
   import { OrderSyncProcessor } from './processors/order-sync.processor';
   import { ThumbnailProcessor } from './processors/thumbnail.processor';
   
   /* =========================
      ENV VALIDATION (FAIL FAST)
      ========================= */
   function validateEnv() {
     const required = [
       'MONGODB_URI',
       'REDIS_HOST',
       'REDIS_PORT',
     ];
   
     const missing = required.filter((key) => !process.env[key]);
   
     if (missing.length > 0) {
       throw new Error(
         `❌ Missing required env variables: ${missing.join(', ')}`
       );
     }
   }
   
   /* =========================
      BOOTSTRAP
      ========================= */
   async function bootstrap() {
     validateEnv();
   
     /* -------- MongoDB -------- */
     await mongoose.connect(process.env.MONGODB_URI as string);
     console.log('✅ Worker connected to MongoDB');
   
     /* -------- Redis -------- */
     const redisConnection = {
       host: process.env.REDIS_HOST as string,
       port: Number(process.env.REDIS_PORT),
       password: process.env.REDIS_PASSWORD || undefined,
     };
   
     console.log(
       `✅ Worker Redis connection: ${redisConnection.host}:${redisConnection.port}`
     );
   
     /* =========================
        ORDER SYNC WORKER
        ========================= */
     const orderSyncWorker = new Worker(
       'order-sync',
       async (job) => {
         const processor = new OrderSyncProcessor();
         return processor.process(job);
       },
       {
         connection: redisConnection,
         concurrency: 5,
         limiter: {
           max: 10,
           duration: 1000,
         },
       }
     );
   
     orderSyncWorker.on('completed', (job) => {
       console.log(`✅ [order-sync] Job ${job.id} completed`);
     });
   
     orderSyncWorker.on('failed', (job, err) => {
       console.error(`❌ [order-sync] Job ${job?.id} failed:`, err.message);
     });
   
     /* =========================
        THUMBNAIL WORKER
        ========================= */
     const thumbnailWorker = new Worker(
       'thumbnail-generation',
       async (job) => {
         const processor = new ThumbnailProcessor();
         return processor.process(job);
       },
       {
         connection: redisConnection,
         concurrency: 10,
       }
     );
   
     thumbnailWorker.on('completed', (job) => {
       console.log(`✅ [thumbnail] Job ${job.id} completed`);
     });
   
     thumbnailWorker.on('failed', (job, err) => {
       console.error(`❌ [thumbnail] Job ${job?.id} failed:`, err.message);
     });
   
     console.log('🚀 Worker started successfully');
   }
   
   /* =========================
      START
      ========================= */
   bootstrap().catch((error) => {
     console.error('🔥 Worker startup failed:', error);
     process.exit(1);
   });