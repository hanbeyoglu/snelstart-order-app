import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRICE_OVERRIDE_LIMIT_PERCENT,
  getMinimumAllowedPrice,
  resolvePriceOverridePolicy,
  validateUnitPriceOverride,
  PRICE_OVERRIDE_PERMISSIONS,
} from '@snelstart-order-app/shared';

test('resolvePriceOverridePolicy: super_admin is full', () => {
  assert.deepEqual(resolvePriceOverridePolicy({ role: 'super_admin' }), { mode: 'full' });
});

test('resolvePriceOverridePolicy: customer is none', () => {
  assert.deepEqual(
    resolvePriceOverridePolicy({
      role: 'customer',
      permissions: [PRICE_OVERRIDE_PERMISSIONS.full],
    }),
    { mode: 'none' },
  );
});

test('resolvePriceOverridePolicy: limited uses percent or default', () => {
  assert.deepEqual(
    resolvePriceOverridePolicy({
      role: 'sales_rep',
      permissions: [PRICE_OVERRIDE_PERMISSIONS.limited],
      priceOverrideLimitPercent: 15,
    }),
    { mode: 'limited', limitPercent: 15 },
  );
  assert.deepEqual(
    resolvePriceOverridePolicy({
      role: 'admin',
      permissions: [PRICE_OVERRIDE_PERMISSIONS.limited],
    }),
    { mode: 'limited', limitPercent: DEFAULT_PRICE_OVERRIDE_LIMIT_PERCENT },
  );
});

test('getMinimumAllowedPrice: purchase vs base rules', () => {
  const fromPurchase = getMinimumAllowedPrice({
    basePrice: 100,
    purchasePrice: 80,
    limitPercent: 10,
  });
  assert.equal(fromPurchase.rule, 'purchase-price');
  assert.equal(fromPurchase.minPrice, 88);

  const fromBase = getMinimumAllowedPrice({
    basePrice: 100,
    purchasePrice: 0,
    limitPercent: 10,
  });
  assert.equal(fromBase.rule, 'base-price');
  assert.equal(fromBase.minPrice, 90);
});

test('validateUnitPriceOverride: full allows any price', () => {
  const result = validateUnitPriceOverride({ mode: 'full' }, 1, 100, 80);
  assert.equal(result.allowed, true);
});

test('validateUnitPriceOverride: limited enforces minimum', () => {
  const policy = { mode: 'limited' as const, limitPercent: 10 };
  assert.equal(validateUnitPriceOverride(policy, 87, 100, 80).allowed, false);
  assert.equal(validateUnitPriceOverride(policy, 88, 100, 80).allowed, true);
});
