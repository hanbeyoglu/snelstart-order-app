import {
  getMinimumAllowedPrice,
  resolvePriceOverridePolicy,
  validateUnitPriceOverride,
  type PriceOverridePolicy,
  type PriceOverrideUserContext,
} from './priceOverridePolicy';

export interface PriceValidationInput {
  price: number;
  basePrice: number;
  purchasePrice?: number | null;
  user?: PriceOverrideUserContext | null;
}

export interface PriceValidationResult {
  isValid: boolean;
  minPrice: number;
  rule: 'base-price' | 'purchase-price';
  canEditPrice: boolean;
  policy: PriceOverridePolicy;
  requiresConfirmation: boolean;
}

export function getPriceValidationContext(user?: PriceOverrideUserContext | null) {
  return resolvePriceOverridePolicy(user ?? { role: 'customer', permissions: [] });
}

export function validatePrice(input: PriceValidationInput): PriceValidationResult {
  const policy = resolvePriceOverridePolicy(input.user ?? { role: 'customer', permissions: [] });

  if (policy.mode === 'none') {
    return {
      isValid: input.price === input.basePrice,
      minPrice: input.basePrice,
      rule: 'base-price',
      canEditPrice: false,
      policy,
      requiresConfirmation: false,
    };
  }

  if (policy.mode === 'full') {
    return {
      isValid: true,
      minPrice: 0,
      rule: 'base-price',
      canEditPrice: true,
      policy,
      requiresConfirmation: input.price < input.basePrice,
    };
  }

  const limitPercent = policy.limitPercent ?? 10;
  const { minPrice, rule } = getMinimumAllowedPrice({
    basePrice: input.basePrice,
    purchasePrice: input.purchasePrice,
    limitPercent,
  });
  const result = validateUnitPriceOverride(
    policy,
    input.price,
    input.basePrice,
    input.purchasePrice,
  );

  return {
    isValid: result.allowed,
    minPrice: result.minPrice ?? minPrice,
    rule,
    canEditPrice: true,
    policy,
    requiresConfirmation: false,
  };
}
