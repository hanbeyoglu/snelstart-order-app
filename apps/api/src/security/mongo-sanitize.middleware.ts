import { BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

function hasUnsafeMongoKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(hasUnsafeMongoKey);
  }

  return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
    return key.startsWith('$') || key.includes('.') || hasUnsafeMongoKey(child);
  });
}

export function assertNoUnsafeMongoKeys(value: unknown): void {
  if (hasUnsafeMongoKey(value)) {
    throw new BadRequestException('Invalid request payload');
  }
}

export function mongoSanitizeMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    assertNoUnsafeMongoKeys(req.body);
    assertNoUnsafeMongoKeys(req.query);
    assertNoUnsafeMongoKeys(req.params);
    next();
  } catch (error) {
    next(error);
  }
}
