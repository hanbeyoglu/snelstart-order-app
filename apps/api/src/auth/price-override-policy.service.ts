import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  PriceOverridePolicy,
  resolvePriceOverridePolicy,
  validateUnitPriceOverride,
  type PriceOverrideUserContext,
} from '@snelstart-order-app/shared';

export type PriceOverrideValidationResult = {
  allowed: boolean;
  policy: PriceOverridePolicy;
  minPrice?: number;
  overrideType?: 'full' | 'limited' | 'none';
};

@Injectable()
export class PriceOverridePolicyService {
  resolvePolicy(user?: PriceOverrideUserContext | null): PriceOverridePolicy {
    if (!user) {
      return { mode: 'none' };
    }
    return resolvePriceOverridePolicy({
      role: user.role,
      permissions: user.permissions,
      priceOverrideLimitPercent: user.priceOverrideLimitPercent,
    });
  }

  assertCanOverridePrice(
    user: PriceOverrideUserContext | undefined,
    requestedPrice: number,
    basePrice: number,
    purchasePrice?: number | null,
  ): PriceOverrideValidationResult {
    const policy = this.resolvePolicy(user);
    const result = validateUnitPriceOverride(policy, requestedPrice, basePrice, purchasePrice);

    if (policy.mode === 'none') {
      throw new ForbiddenException('PRICE_OVERRIDE_NOT_ALLOWED');
    }

    if (!result.allowed) {
      throw new BadRequestException({
        message: 'PRICE_BELOW_MINIMUM',
        minPrice: result.minPrice,
        limitPercent: policy.limitPercent,
      });
    }

    return {
      allowed: true,
      policy,
      minPrice: result.minPrice,
      overrideType: policy.mode === 'full' ? 'full' : 'limited',
    };
  }

  validateLimitPercentForPermissions(
    permissions: string[],
    priceOverrideLimitPercent?: number | null,
  ): number | undefined {
    const hasLimited = permissions.includes('price.override.limited');
    const hasFull = permissions.includes('price.override.full');

    if (hasFull && hasLimited) {
      throw new BadRequestException('price.override.full ve price.override.limited birlikte seçilemez');
    }

    if (hasLimited) {
      const percent = Number(priceOverrideLimitPercent);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new BadRequestException('Limitli fiyat değiştirme için 0-100 arası limit yüzdesi zorunludur');
      }
      return Math.round(percent * 100) / 100;
    }

    if (priceOverrideLimitPercent !== undefined && priceOverrideLimitPercent !== null) {
      throw new BadRequestException('Fiyat limiti yalnızca limitli fiyat değiştirme izni ile kullanılabilir');
    }

    return undefined;
  }
}
