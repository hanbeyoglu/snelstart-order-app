import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Reflector } from '@nestjs/core';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { assertNoUnsafeMongoKeys } from './mongo-sanitize.middleware';
import { getJwtSecret } from './env';
import { AuthController } from '../auth/auth.controller';
import { AuditController } from '../audit/audit.controller';
import { PricingController } from '../pricing/pricing.controller';
import { ProductsController } from '../products/products.controller';
import { CategoriesController } from '../categories/categories.controller';
import { ConnectionSettingsController } from '../connection-settings/connection-settings.controller';
import { OrdersService } from '../orders/orders.service';
import { ReportsController } from '../reports/reports.controller';
import { UsersService } from '../users/users.service';

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
  assert.equal(guard.canActivate(contextFor(handler, { role: 'super_admin' })), true);
});

test('role guard protects super_admin-only handlers from admins', () => {
  const handler = () => undefined;
  Reflect.defineMetadata('roles', ['super_admin'], handler);

  const guard = new RolesGuard(new Reflector());

  assert.equal(guard.canActivate(contextFor(handler, { role: 'admin' })), false);
  assert.equal(guard.canActivate(contextFor(handler, { role: 'super_admin' })), true);
});

test('admin-only endpoint metadata is present on sensitive routes', () => {
  assert.deepEqual(Reflect.getMetadata('roles', AuthController.prototype.register), ['admin']);
  assert.deepEqual(Reflect.getMetadata('roles', PricingController.prototype.createRule), ['admin']);
  assert.deepEqual(Reflect.getMetadata('roles', PricingController.prototype.updateRule), ['admin']);
  assert.deepEqual(Reflect.getMetadata('roles', ProductsController.prototype.syncProductsAndCategories), ['admin']);
  assert.deepEqual(Reflect.getMetadata('roles', ProductsController.prototype.syncProductsDelta), ['admin']);
  assert.deepEqual(Reflect.getMetadata('roles', CategoriesController.prototype.syncCategories), ['admin']);
});

test('super_admin-only endpoint metadata is present on sensitive routes', () => {
  assert.deepEqual(Reflect.getMetadata('roles', ReportsController.prototype.getReport), ['super_admin']);
  assert.deepEqual(Reflect.getMetadata('roles', AuditController.prototype.getAuditLogs), ['super_admin']);
  assert.deepEqual(Reflect.getMetadata('roles', ConnectionSettingsController.prototype.saveSettings), ['super_admin']);
  assert.deepEqual(Reflect.getMetadata('roles', ConnectionSettingsController.prototype.testConnection), ['super_admin']);
  assert.deepEqual(Reflect.getMetadata('roles', ConnectionSettingsController.prototype.refreshToken), ['super_admin']);
  assert.deepEqual(Reflect.getMetadata('roles', ConnectionSettingsController.prototype.getCompanyInfo), ['super_admin']);
});

test('reports endpoint is blocked for admin and allowed for super_admin', () => {
  const guard = new RolesGuard(new Reflector());
  const handler = ReportsController.prototype.getReport;

  assert.equal(guard.canActivate(contextFor(handler, { role: 'admin' })), false);
  assert.equal(guard.canActivate(contextFor(handler, { role: 'super_admin' })), true);
});

test('audit logs endpoint is blocked for admin and allowed for super_admin', () => {
  const guard = new RolesGuard(new Reflector());
  const handler = AuditController.prototype.getAuditLogs;

  assert.equal(guard.canActivate(contextFor(handler, { role: 'admin' })), false);
  assert.equal(guard.canActivate(contextFor(handler, { role: 'super_admin' })), true);
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

function execResult<T>(value: T) {
  return { exec: async () => value };
}

test('admin users list filters out super_admin users', async () => {
  let findFilter: any;
  const model = {
    find: (filter: any) => {
      findFilter = filter;
      return { select: () => execResult([]) };
    },
  };
  const service = new UsersService(model as any);

  await service.getAllUsers('admin');

  assert.deepEqual(findFilter, { role: { $ne: 'super_admin' } });
});

test('super_admin users list can include super_admin users', async () => {
  let findFilter: any;
  const model = {
    find: (filter: any) => {
      findFilter = filter;
      return { select: () => execResult([]) };
    },
  };
  const service = new UsersService(model as any);

  await service.getAllUsers('super_admin');

  assert.deepEqual(findFilter, {});
});

test('admin cannot assign super_admin role', async () => {
  const model = {
    findOne: () => execResult(null),
  };
  const service = new UsersService(model as any);

  await assert.rejects(
    () => service.createUser('new-user', undefined, 'password123', 'super_admin', undefined, undefined, 'admin'),
    ForbiddenException,
  );
});

test('admin cannot update or delete super_admin users', async () => {
  const superAdminUser = { _id: 'user-1', role: 'super_admin' };
  const model = {
    findById: () => execResult(superAdminUser),
  };
  const service = new UsersService(model as any);

  await assert.rejects(
    () => service.updateUser('user-1', { username: 'changed' }, true, 'admin'),
    ForbiddenException,
  );
  await assert.rejects(
    () => service.deleteUser('user-1', 'admin'),
    ForbiddenException,
  );
});

test('role dropdown hides super_admin option from admin users', () => {
  const createUserPage = fs.readFileSync(path.resolve(process.cwd(), '../web/src/pages/CreateUserPage.tsx'), 'utf8');
  const editUserPage = fs.readFileSync(path.resolve(process.cwd(), '../web/src/pages/EditUserPage.tsx'), 'utf8');

  assert.match(createUserPage, /currentUser\?\.role === 'super_admin'/);
  assert.match(editUserPage, /currentUser\?\.role === 'super_admin'/);
});
