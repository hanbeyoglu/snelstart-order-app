import { Request, Response, NextFunction } from 'express';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix?: string;
};

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getClientKey(req: Request, keyPrefix: string): string {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return `${keyPrefix}:${forwardedIp || req.ip || req.socket.remoteAddress || 'unknown'}`;
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  const keyPrefix = options.keyPrefix || 'global';
  const store = stores.get(keyPrefix) || new Map<string, RateLimitEntry>();
  stores.set(keyPrefix, store);

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = getClientKey(req, keyPrefix);
    const entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > options.max) {
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests',
        error: 'Too Many Requests',
      });
      return;
    }

    next();
  };
}
