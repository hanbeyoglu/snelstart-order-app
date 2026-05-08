export interface PriceValidationInput {
  price: number;
  basePrice: number;
  purchasePrice?: number | null;
}

export interface PriceValidationResult {
  isValid: boolean;
  minPrice: number;
  rule: 'base-price' | 'purchase-price';
}

export function getMinimumAllowedPrice(input: Omit<PriceValidationInput, 'price'>): {
  minPrice: number;
  rule: PriceValidationResult['rule'];
} {
  const purchasePrice = input.purchasePrice ?? 0;

  if (purchasePrice > 0) {
    return {
      minPrice: purchasePrice * 1.05,
      rule: 'purchase-price',
    };
  }

  return {
    minPrice: input.basePrice * 0.95,
    rule: 'base-price',
  };
}

export function validatePrice(input: PriceValidationInput): PriceValidationResult {
  const { minPrice, rule } = getMinimumAllowedPrice(input);

  return {
    minPrice,
    rule,
    isValid: input.price >= minPrice,
  };
}
