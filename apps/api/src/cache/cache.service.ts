import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class CacheService {
  constructor(@Inject('REDIS_CLIENT') private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async invalidateProductCache(productId?: string): Promise<void> {
    if (productId) {
      await this.deletePattern(`product:${productId}:*`);
    }
    await this.deletePattern('products:*');
  }

  async invalidateCategoryCache(): Promise<void> {
    await this.delete('categories:all');
  }

  async invalidateCustomerCache(): Promise<void> {
    await this.deletePattern('customers:*');
    await this.deletePattern('customer:*');
  }
}

