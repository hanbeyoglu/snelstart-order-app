import { BadRequestException } from '@nestjs/common';

type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error?: unknown };

type SafeParseSchema<T> = {
  safeParse(value: unknown): SafeParseResult<T>;
};

export function parseOrBadRequest<T>(schema: SafeParseSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException('Invalid request payload');
  }
  return result.data;
}
