import { useMemo } from 'react';
import { resolvePriceOverridePolicy } from '../utils/priceOverridePolicy';
import { useAuthStore } from '../store/authStore';

export function usePriceOverridePolicy() {
  const user = useAuthStore((state) => state.user);

  return useMemo(() => {
    const policy = resolvePriceOverridePolicy({
      role: user?.role ?? 'customer',
      permissions: user?.permissions,
      priceOverrideLimitPercent: user?.priceOverrideLimitPercent,
    });

    return {
      policy,
      canOverridePrice: policy.mode !== 'none',
      isFullOverride: policy.mode === 'full',
      isLimitedOverride: policy.mode === 'limited',
      limitPercent: policy.limitPercent,
    };
  }, [user?.role, user?.permissions, user?.priceOverrideLimitPercent]);
}
