export const PRICE_OVERRIDE_PERMISSIONS = {
  full: 'price.override.full',
  limited: 'price.override.limited',
} as const;

export const DEFAULT_PRICE_OVERRIDE_LIMIT_PERCENT = 10;

export type PriceOverrideMode = 'full' | 'limited' | 'none';

export type PriceOverridePolicy = {
  mode: PriceOverrideMode;
  limitPercent?: number;
};

export type PriceOverrideUserContext = {
  role: string;
  permissions?: string[];
  priceOverrideLimitPercent?: number | null;
};

export type MinimumPriceInput = {
  basePrice: number;
  purchasePrice?: number | null;
  limitPercent: number;
};

export type MinimumPriceResult = {
  minPrice: number;
  rule: 'purchase-price' | 'base-price';
};

export function getMinimumAllowedPrice(input: MinimumPriceInput): MinimumPriceResult {
  const purchasePrice = input.purchasePrice ?? 0;
  const factor = 1 + input.limitPercent / 100;

  if (purchasePrice > 0) {
    return {
      minPrice: roundMoney(purchasePrice * factor),
      rule: 'purchase-price',
    };
  }

  return {
    minPrice: roundMoney(input.basePrice * (1 - input.limitPercent / 100)),
    rule: 'base-price',
  };
}

export function resolvePriceOverridePolicy(user: PriceOverrideUserContext): PriceOverridePolicy {
  if (user.role === 'super_admin') {
    return { mode: 'full' };
  }

  if (user.role === 'customer') {
    return { mode: 'none' };
  }

  const permissions = user.permissions ?? [];
  if (permissions.includes(PRICE_OVERRIDE_PERMISSIONS.full)) {
    return { mode: 'full' };
  }

  if (permissions.includes(PRICE_OVERRIDE_PERMISSIONS.limited)) {
    const limitPercent = normalizeLimitPercent(user.priceOverrideLimitPercent) ?? DEFAULT_PRICE_OVERRIDE_LIMIT_PERCENT;
    return { mode: 'limited', limitPercent };
  }

  return { mode: 'none' };
}

export function canChangeUnitPrice(policy: PriceOverridePolicy): boolean {
  return policy.mode !== 'none';
}

export function validateUnitPriceOverride(
  policy: PriceOverridePolicy,
  requestedPrice: number,
  basePrice: number,
  purchasePrice?: number | null,
): { allowed: boolean; minPrice?: number; rule?: MinimumPriceResult['rule'] } {
  if (policy.mode === 'none') {
    return { allowed: false };
  }

  if (policy.mode === 'full') {
    return { allowed: true };
  }

  const limitPercent = policy.limitPercent ?? DEFAULT_PRICE_OVERRIDE_LIMIT_PERCENT;
  const { minPrice, rule } = getMinimumAllowedPrice({ basePrice, purchasePrice, limitPercent });

  return {
    allowed: requestedPrice >= minPrice,
    minPrice,
    rule,
  };
}

export function normalizeLimitPercent(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < 0 || parsed > 100) return undefined;
  return Math.round(parsed * 100) / 100;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
