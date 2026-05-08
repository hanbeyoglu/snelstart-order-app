import test from 'node:test';
import assert from 'node:assert/strict';
import { Reflector } from '@nestjs/core';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequireAdminCabirGuard } from '../reports/guards/require-admin-cabir.guard';
import { assertNoUnsafeMongoKeys } from './mongo-sanitize.middleware';
import { getJwtSecret } from './env';
import { AuthController } from '../auth/auth.controller';
import { PricingController } from '../pricing/pricing.controller';
import { ProductsController } from '../products/products.controller';
import { CategoriesController } from '../categories/categories.controller';
import { ConnectionSettingsController } from '../connection-settings/connection-settings.controller';
import { OrdersService } from '../orders/orders.service';

function contextFor(handler: Function, user: any) {
  return {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

test('role guard blocks non-admin users from admin handlers', () => {
  const handler = () => undefined;
  Reflect.defineMetadata('roles', ['admin'], handler);

  const guard = new RolesGuard(new Reflector());

  assert.equal(guard.canActivate(contextFor(handler, { role: 'sales_rep' })), false);
  assert.equal(guard.canActivate(contextFor(handler, { role: 'admin' })), true);
});

test('admin_cabir report guard also requires admin role', () => {
  const guard = new RequireAdminCabirGuard();

  assert.throws(
    () => guard.canActivate(contextFor(() => undefined, { username: 'admin_cabir', role: 'sales_rep' })),
    NotFoundException,
  );
  assert.equal(
    guard.canActivate(contextFor(() => undefined, { username: 'admin_cabir', role: 'admin' })),
    true,
  );
});

test('admin-only endpoint metadata is present on sensitive routes', () => {
  assert.deepEqual(Reflect.getMetadata('roles', AuthController.prototype.register), ['admin']);
  assert.deepEqual(Reflect.getMetadata('roles', PricingController.prototype.createRule), ['admin']);
  assert.deepEqual(Reflect.getMetadata('roles', PricingController.prototype.updateRule), ['admin']);
  assert.deepEqual(Reflect.getMetadata('roles', ProductsController.prototype.syncProductsAndCategories), ['admin']);
  assert.deepEqual(Reflect.getMetadata('roles', ProductsController.prototype.syncProductsDelta), ['admin']);
  assert.deepEqual(Reflect.getMetadata('roles', CategoriesController.prototype.syncCategories), ['admin']);
  assert.deepEqual(Reflect.getMetadata('roles', ConnectionSettingsController.prototype.refreshToken), ['admin']);
});

test('mongo sanitizer rejects query operator injection payloads', () => {
  assert.throws(
    () => assertNoUnsafeMongoKeys({ email: { $ne: null } }),
    BadRequestException,
  );
  assert.throws(
    () => assertNoUnsafeMongoKeys({ 'profile.role': 'admin' }),
    BadRequestException,
  );
  assert.doesNotThrow(() => assertNoUnsafeMongoKeys({ email: 'user@example.com' }));
});

test('production rejects weak JWT secrets', () => {
  const previousEnv = process.env.NODE_ENV;
  const previousSecret = process.env.JWT_SECRET;

  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'your-secret-key-change-in-production';
  assert.throws(() => getJwtSecret(), /JWT_SECRET/);

  process.env.JWT_SECRET = '0123456789abcdefghijklmnopqrstuvwxyz';
  assert.equal(getJwtSecret(), '0123456789abcdefghijklmnopqrstuvwxyz');

  process.env.NODE_ENV = previousEnv;
  if (previousSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousSecret;
  }
});

test('order creation rebuilds prices server-side and ignores client overrides', async () => {
  const productsService = {
    getProductById: async () => ({
      id: 'product-1',
      omschrijving: 'Trusted product',
      artikelnummer: 'SKU-1',
      finalPrice: 12,
      basePrice: 15,
      btwPercentage: 21,
      artikelgroepId: 'cat-1',
    }),
  };
  const service = new OrdersService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    productsService as any,
  );

  const items = await (service as any).buildTrustedOrderItems(
    [{ productId: 'product-1', quantity: 2, unitPrice: 12 }],
    'customer-1',
  );

  assert.equal(items[0].unitPrice, 12);
  assert.equal(items[0].basePrice, 15);
  assert.equal(items[0].totalPrice, 24);
  assert.equal(items[0].customUnitPrice, undefined);

  await assert.rejects(
    () =>
      (service as any).buildTrustedOrderItems(
        [{ productId: 'product-1', quantity: 2, unitPrice: 1, customUnitPrice: 1 }],
        'customer-1',
        { role: 'sales_rep' },
      ),
    /ADMIN_PRICE_OVERRIDE_REQUIRED/,
  );
});
