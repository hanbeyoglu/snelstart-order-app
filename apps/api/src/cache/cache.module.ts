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
        const redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          retryStrategy: (times) => {
            if (times > 10) {
              return null; // Stop retrying after 10 attempts
            }
            return Math.min(times * 50, 2000);
          },
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
        
        // Handle connection errors gracefully
        redis.on('error', (err) => {
          console.warn('Redis connection error (non-fatal):', err.message);
        });
        
        // Try to connect, but don't fail if it doesn't work
        redis.connect().catch(() => {
          console.warn('Redis connection failed, continuing without cache');
        });
        
        return redis;
      },
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}

