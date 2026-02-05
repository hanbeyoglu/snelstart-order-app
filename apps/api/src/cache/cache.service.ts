import { Injectable, Inject, Optional } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class CacheService {
  private isRedisConnected: boolean = false;

  constructor(@Inject('REDIS_CLIENT') @Optional() private redis?: Redis) {
    if (this.redis) {
      // Check if Redis is connected
      this.redis.on('connect', () => {
        this.isRedisConnected = true;
      });
      
      this.redis.on('ready', () => {
        this.isRedisConnected = true;
      });
      
      this.redis.on('error', () => {
        this.isRedisConnected = false;
      });
      
      this.redis.on('close', () => {
        this.isRedisConnected = false;
      });

      // Check initial connection status
      this.checkConnection();
    }
  }

  private async checkConnection(): Promise<void> {
    if (!this.redis) {
      this.isRedisConnected = false;
      return;
    }

    try {
      const status = this.redis.status;
      this.isRedisConnected = status === 'ready' || status === 'connecting';
    } catch {
      this.isRedisConnected = false;
    }
  }

  private async safeRedisOperation<T>(
    operation: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    if (!this.redis || !this.isRedisConnected) {
      return fallback;
    }

    try {
      await this.checkConnection();
      if (!this.isRedisConnected) {
        return fallback;
      }
      return await operation();
    } catch (error) {
      // Silently fail - cache is optional
      this.isRedisConnected = false;
      return fallback;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    return this.safeRedisOperation(
      async () => {
        const value = await this.redis!.get(key);
        if (!value) return null;
        return JSON.parse(value) as T;
      },
      null,
    );
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    await this.safeRedisOperation(
      async () => {
        const serialized = JSON.stringify(value);
        if (ttlSeconds) {
          await this.redis!.setex(key, ttlSeconds, serialized);
        } else {
          await this.redis!.set(key, serialized);
        }
      },
      undefined,
    );
  }

  async delete(key: string): Promise<void> {
    await this.safeRedisOperation(
      async () => {
        await this.redis!.del(key);
      },
      undefined,
    );
  }

  async deletePattern(pattern: string): Promise<void> {
    await this.safeRedisOperation(
      async () => {
        const keys = await this.redis!.keys(pattern);
        if (keys.length > 0) {
          await this.redis!.del(...keys);
        }
      },
      undefined,
    );
  }

  async invalidateProductCache(productId?: string): Promise<void> {
    if (productId) {
      await this.deletePattern(`product:${productId}:*`);
    }
    await this.deletePattern('products:*');
  }

  async invalidateCategoryCache(): Promise<void> {
    await this.deletePattern('categories:*');
  }

  async invalidateCustomerCache(): Promise<void> {
    await this.deletePattern('customers:*');
    await this.deletePattern('customer:*');
  }
}

