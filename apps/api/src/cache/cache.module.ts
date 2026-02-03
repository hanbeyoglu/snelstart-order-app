import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { Redis } from 'ioredis';

@Global()
@Module({
  providers: [
    CacheService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        const redisHost = process.env.REDIS_HOST || 'localhost';
        const redisPort = parseInt(process.env.REDIS_PORT || '6379');
        
        // Only create Redis client if host is provided
        if (!redisHost || redisHost === '') {
          console.warn('⚠️  REDIS_HOST not set, cache will be disabled');
          return null;
        }

        const redis = new Redis({
          host: redisHost,
          port: redisPort,
          password: process.env.REDIS_PASSWORD,
          retryStrategy: (times) => {
            // Stop retrying after 5 attempts to reduce spam
            if (times > 5) {
              console.warn('⚠️  Redis connection failed after 5 attempts, cache disabled');
              return null;
            }
            return Math.min(times * 100, 1000);
          },
          maxRetriesPerRequest: 1, // Reduce retries
          lazyConnect: true,
          enableOfflineQueue: false, // Don't queue commands when offline
          connectTimeout: 2000, // 2 second timeout
        });
        
        // Handle connection errors gracefully - only log once
        let errorLogged = false;
        redis.on('error', (err) => {
          if (!errorLogged) {
            console.warn(`⚠️  Redis connection error (cache disabled): ${err.message}`);
            errorLogged = true;
          }
        });
        
        redis.on('connect', () => {
          console.log('✅ Redis connected');
          errorLogged = false;
        });
        
        redis.on('ready', () => {
          console.log('✅ Redis ready');
        });
        
        // Try to connect, but don't fail if it doesn't work
        redis.connect().catch(() => {
          // Connection failed, but that's OK - cache is optional
        });
        
        return redis;
      },
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}

