import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Reflector } from '@nestjs/core';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { validate } from 'class-validator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditViewGuard } from '../auth/guards/audit-view.guard';
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
import { PriceOverridePolicyService } from '../auth/price-override-policy.service';
import { CreateUserDto, UpdateCurrentUserDto } from '../users/dto/user.dto';

const priceOverridePolicyService = new PriceOverridePolicyService();

function createOrdersService(
  orderModel: any = {},
  productModel: any = {},
  userModel: any = {},
  orderSyncQueue: any = {},
  snelStartService: any = {},
  auditService: any = { log: async () => undefined },
  customersService: any = {},
  productsService: any = {},
  pricingService: any = {},
  categoriesService: any = {},
) {
  return new OrdersService(
    orderModel as any,
    productModel as any,
    userModel as any,
    orderSyncQueue as any,
    snelStartService as any,
    auditService as any,
    customersService as any,
    productsService as any,
    pricingService as any,
    categoriesService as any,
    priceOverridePolicyService,
    undefined,
    undefined,
  );
}

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
  assert.deepEqual(Reflect.getMetadata('roles', ConnectionSettingsController.prototype.saveSettings), ['super_admin']);
  assert.deepEqual(Reflect.getMetadata('roles', ConnectionSettingsController.prototype.testConnection), ['super_admin']);
  assert.deepEqual(Reflect.getMetadata('roles', ConnectionSettingsController.prototype.refreshToken), [
    'super_admin',
    'admin',
  ]);
  assert.deepEqual(Reflect.getMetadata('roles', ConnectionSettingsController.prototype.getCompanyInfo), ['super_admin']);
});

test('reports endpoint is blocked for admin and allowed for super_admin', () => {
  const guard = new RolesGuard(new Reflector());
  const handler = ReportsController.prototype.getReport;

  assert.equal(guard.canActivate(contextFor(handler, { role: 'admin' })), false);
  assert.equal(guard.canActivate(contextFor(handler, { role: 'super_admin' })), true);
});

test('audit logs route uses staff role plus audit.view permission guard', () => {
  assert.deepEqual(Reflect.getMetadata('roles', AuditController.prototype.getAuditLogs), ['sales_rep']);
  assert.deepEqual(Reflect.getMetadata('roles', AuditController.prototype.getAuditStats), ['sales_rep']);
  const rolesGuard = new RolesGuard(new Reflector());
  const handler = AuditController.prototype.getAuditLogs;
  assert.equal(rolesGuard.canActivate(contextFor(handler, { role: 'sales_rep' })), true);
  assert.equal(rolesGuard.canActivate(contextFor(handler, { role: 'admin' })), true);
  assert.equal(rolesGuard.canActivate(contextFor(handler, { role: 'super_admin' })), true);
  assert.equal(rolesGuard.canActivate(contextFor(handler, { role: 'customer' })), false);
});

test('audit view guard requires audit.view in effective permissions', () => {
  const guard = new AuditViewGuard();
  const ctx = (user: any) =>
    ({
      getHandler: () => AuditController.prototype.getAuditLogs,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as any;
  assert.equal(guard.canActivate(ctx({ role: 'admin', permissions: ['audit.view'] })), true);
  assert.equal(guard.canActivate(ctx({ role: 'super_admin', permissions: [] })), true);
  assert.throws(() => guard.canActivate(ctx({ role: 'admin', permissions: [] })), ForbiddenException);
  assert.throws(() => guard.canActivate(ctx({ role: 'sales_rep', permissions: ['dashboard.view'] })), ForbiddenException);
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
  const service = createOrdersService({}, {}, {}, {}, {}, {}, {}, productsService);

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
    /PRICE_OVERRIDE_NOT_ALLOWED/,
  );
});

function execResult<T>(value: T) {
  return { exec: async () => value };
}

function createOrderTestHarness(customersService: any = {}) {
  let lastOrder: any;
  let lastPayload: any;

  class TestOrderModel {
    _id = { toString: () => 'order-1' };
    createdAt = new Date('2026-05-10T10:00:00.000Z');

    constructor(data: any) {
      Object.assign(this, data);
      lastOrder = this;
    }

    async save() {
      lastOrder = this;
      return this;
    }

    static findOne() {
      return execResult(null);
    }
  }

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
  const userModel = {
    findById: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => ({
            role: 'admin',
            permissions: ['price.override.full'],
            priceOverrideLimitPercent: null,
          }),
        }),
      }),
    }),
  };

  const service = createOrdersService(
    TestOrderModel,
    {},
    userModel,
    { add: async () => undefined },
    {
      createSalesOrder: async (payload: any) => {
        lastPayload = payload;
        return { id: 'snel-order-1' };
      },
    },
    { log: async () => undefined },
    customersService,
    productsService,
    {},
    { getActiveCategoryIds: async () => [] },
  );

  return {
    service,
    getLastOrder: () => lastOrder,
    getLastPayload: () => lastPayload,
  };
}

function createOrderPayload(overrides: Record<string, any> = {}) {
  return {
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    customerId: 'customer-1',
    items: [
      {
        productId: 'product-1',
        productName: 'Client product',
        sku: 'CLIENT-SKU',
        quantity: 2,
        unitPrice: 12,
        basePrice: 12,
        totalPrice: 24,
        vatPercentage: 21,
      },
    ],
    ...overrides,
  };
}

test('admin users list filters out super_admin users', async () => {
  let findFilter: any;
  const model = {
    find: (filter: any) => {
      findFilter = filter;
      return { select: () => execResult([]) };
    },
  };
  const service = new UsersService(model as any, priceOverridePolicyService);

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
  const service = new UsersService(model as any, priceOverridePolicyService);

  await service.getAllUsers('super_admin');

  assert.deepEqual(findFilter, {});
});

test('admin order creation stores authenticated user snapshot and ignores client createdBy overrides', async () => {
  const { service, getLastOrder, getLastPayload } = createOrderTestHarness();

  await service.createOrder(
    createOrderPayload({
      createdByFullName: 'Mallory Client',
      createdByRole: 'customer',
      createdByCustomerName: 'Fake Customer',
    }),
    {
      userId: 'admin-1',
      username: 'halil',
      firstName: 'Halil',
      lastName: 'Selek',
      role: 'admin',
    },
  );

  assert.equal(getLastOrder().createdByUserId, 'admin-1');
  assert.equal(getLastOrder().createdByUsername, 'halil');
  assert.equal(getLastOrder().createdByFullName, 'Halil Selek');
  assert.equal(getLastOrder().createdByRole, 'admin');
  assert.equal(getLastOrder().createdByCustomerName, undefined);
  assert.match(getLastPayload().memo, /Özel yazılımdan gelen sipariş\nOluşturan: Halil Selek/);
});

test('sales_rep order creation stores sales user as creator', async () => {
  const { service, getLastOrder, getLastPayload } = createOrderTestHarness();

  await service.createOrder(
    createOrderPayload({ idempotencyKey: '22222222-2222-4222-8222-222222222222' }),
    {
      userId: 'sales-1',
      username: 'sales',
      firstName: 'Seda',
      lastName: 'Yilmaz',
      role: 'sales_rep',
    },
  );

  assert.equal(getLastOrder().createdByUserId, 'sales-1');
  assert.equal(getLastOrder().createdByFullName, 'Seda Yilmaz');
  assert.equal(getLastOrder().createdByRole, 'sales_rep');
  assert.match(getLastPayload().memo, /Oluşturan: Seda Yilmaz/);
});

test('customer order creation uses user customerId and customer name snapshot', async () => {
  const { service, getLastOrder, getLastPayload } = createOrderTestHarness({
    getCustomerById: async () => ({ id: 'customer-actual', naam: 'DHY Food BV' }),
  });

  await service.createOrder(
    createOrderPayload({
      idempotencyKey: '33333333-3333-4333-8333-333333333333',
      customerId: 'client-selected-customer',
      createdByCustomerName: 'Fake Customer',
    }),
    {
      userId: 'portal-1',
      username: 'portal',
      role: 'customer',
      customerId: 'customer-actual',
    },
  );

  assert.equal(getLastOrder().customerId, 'customer-actual');
  assert.equal(getLastOrder().createdByUserId, 'portal-1');
  assert.equal(getLastOrder().createdByRole, 'customer');
  assert.equal(getLastOrder().createdByCustomerId, 'customer-actual');
  assert.equal(getLastOrder().createdByCustomerName, 'DHY Food BV');
  assert.match(getLastPayload().memo, /Oluşturan müşteri: DHY Food BV/);
});

test('SnelStart creator note preserves existing memo content', () => {
  const { service } = createOrderTestHarness();

  const note = (service as any).appendCreatorNote('Teslimat: Markete Teslim', {
    createdByFullName: 'Halil Selek',
    createdByRole: 'admin',
  });

  assert.equal(note, 'Teslimat: Markete Teslim\nOluşturan: Halil Selek');
});

test('customer order list is limited to orders created by that portal user', async () => {
  let findFilter: any;
  const model = {
    find: (filter: any) => {
      findFilter = filter;
      return {
        sort: () => ({
          limit: () => execResult([]),
          skip: () => ({ limit: () => execResult([]) }),
        }),
      };
    },
    countDocuments: () => execResult(0),
  };
  const service = createOrdersService(model);

  await service.getOrders({}, {
    userId: 'portal-1',
    role: 'customer',
    customerId: 'customer-1',
  });

  assert.deepEqual(findFilter, {
    customerId: 'customer-1',
    createdByUserId: 'portal-1',
  });
});

test('customer order detail blocks same-customer orders created by another user', async () => {
  const model = {
    findById: () => execResult({
      _id: 'order-1',
      customerId: 'customer-1',
      createdByUserId: 'portal-2',
    }),
  };
  const service = createOrdersService(model);

  await assert.rejects(
    () => service.getOrderById('order-1', {
      userId: 'portal-1',
      role: 'customer',
      customerId: 'customer-1',
    }),
    /Order not found/,
  );
});

test('customer order detail allows own created order', async () => {
  const ownOrder = {
    _id: 'order-1',
    customerId: 'customer-1',
    createdByUserId: 'portal-1',
  };
  const model = {
    findById: () => execResult(ownOrder),
  };
  const service = createOrdersService(model);

  const result = await service.getOrderById('order-1', {
    userId: 'portal-1',
    role: 'customer',
    customerId: 'customer-1',
  });

  assert.equal(result, ownOrder);
});

test('reorderOrder rejects access to another customer order', async () => {
  const foreignOrder = {
    _id: { toString: () => 'order-foreign' },
    customerId: 'customer-2',
    createdByUserId: 'portal-2',
    items: [],
  };
  const model = {
    findById: () => execResult(foreignOrder),
  };
  const service = createOrdersService(model);

  await assert.rejects(
    () =>
      service.reorderOrder('order-foreign', {
        userId: 'portal-1',
        role: 'customer',
        customerId: 'customer-1',
      }),
    /Order not found/,
  );
});

test('reorderOrder recomputes prices from current product data, not stored item', async () => {
  const sourceOrder = {
    _id: { toString: () => 'order-1' },
    orderNumber: 'SO-20260510-ABCDEF',
    customerId: 'customer-1',
    createdByUserId: 'portal-1',
    items: [
      {
        productId: 'product-1',
        productName: 'Old name',
        sku: 'SKU-OLD',
        quantity: 3,
        unitPrice: 5.0,
        basePrice: 6.0,
      },
    ],
  };
  const model = {
    findById: () => execResult(sourceOrder),
  };
  const productsService = {
    getProductById: async (id: string, _customerId: string, enforceActive?: boolean) => {
      assert.equal(id, 'product-1');
      assert.equal(enforceActive, true);
      return {
        id: 'product-1',
        omschrijving: 'New name',
        artikelnummer: 'SKU-NEW',
        finalPrice: 12.5,
        basePrice: 15,
        btwPercentage: 21,
        artikelgroepId: 'cat-1',
        isActive: true,
      };
    },
  };
  const categoriesService = {
    getActiveCategoryIds: async () => ['cat-1'],
  };
  const auditService = { log: async () => undefined };
  const service = createOrdersService(
    model,
    {},
    {},
    {},
    {},
    auditService,
    {},
    productsService,
    {},
    categoriesService,
  );

  const result = await service.reorderOrder('order-1', {
    userId: 'portal-1',
    role: 'customer',
    customerId: 'customer-1',
  });

  assert.equal(result.items.length, 1);
  const reorderedItem = result.items[0];
  assert.equal(reorderedItem.productId, 'product-1');
  assert.equal(reorderedItem.productName, 'New name');
  assert.equal(reorderedItem.sku, 'SKU-NEW');
  assert.equal(reorderedItem.quantity, 3);
  // Critical: price must come from fresh product, NOT from sourceOrder
  assert.equal(reorderedItem.unitPrice, 12.5);
  assert.equal(reorderedItem.unitPriceExclVat, 12.5);
  assert.equal(reorderedItem.totalPrice, 37.5);
  assert.equal(reorderedItem.vatPercentage, 21);
  // priceUpdates surfaces the change (5 -> 12.5)
  assert.equal(result.priceUpdates.length, 1);
  assert.equal(result.priceUpdates[0].oldUnitPrice, 5);
  assert.equal(result.priceUpdates[0].newUnitPrice, 12.5);
  assert.equal(result.skipped.length, 0);
  assert.equal(result.stats.priceChangedCount, 1);
});

test('reorderOrder skips items when product is inactive or not found', async () => {
  const sourceOrder = {
    _id: { toString: () => 'order-2' },
    orderNumber: 'SO-20260510-DEAD00',
    customerId: 'customer-1',
    createdByUserId: 'portal-1',
    items: [
      { productId: 'product-active', productName: 'Active', sku: 'SKU-A', quantity: 2, unitPrice: 10 },
      { productId: 'product-inactive', productName: 'Inactive', sku: 'SKU-I', quantity: 1, unitPrice: 8 },
      { productId: 'product-missing', productName: 'Missing', sku: 'SKU-M', quantity: 4, unitPrice: 9 },
    ],
  };
  const model = {
    findById: () => execResult(sourceOrder),
  };
  const productsService = {
    getProductById: async (id: string) => {
      if (id === 'product-active') {
        return {
          id: 'product-active',
          omschrijving: 'Active',
          artikelnummer: 'SKU-A',
          finalPrice: 11,
          basePrice: 11,
          btwPercentage: 9,
          artikelgroepId: 'cat-1',
          isActive: true,
        };
      }
      if (id === 'product-inactive') {
        return {
          id: 'product-inactive',
          omschrijving: 'Inactive',
          artikelnummer: 'SKU-I',
          finalPrice: 8,
          basePrice: 8,
          btwPercentage: 9,
          artikelgroepId: 'cat-1',
          isActive: false,
        };
      }
      throw new Error('Product not found');
    },
  };
  const categoriesService = {
    getActiveCategoryIds: async () => ['cat-1'],
  };
  const auditService = { log: async () => undefined };
  const service = createOrdersService(
    model,
    {},
    {},
    {},
    {},
    auditService,
    {},
    productsService,
    {},
    categoriesService,
  );

  const result = await service.reorderOrder('order-2', {
    userId: 'portal-1',
    role: 'customer',
    customerId: 'customer-1',
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].productId, 'product-active');
  assert.equal(result.items[0].unitPrice, 11);
  assert.equal(result.skipped.length, 2);
  const skippedIds = result.skipped.map((s: any) => s.productId).sort();
  assert.deepEqual(skippedIds, ['product-inactive', 'product-missing']);
  const inactive = result.skipped.find((s: any) => s.productId === 'product-inactive');
  assert.equal(inactive?.reason, 'product_inactive');
});

test('reorderOrder skips items whose category is no longer active', async () => {
  const sourceOrder = {
    _id: { toString: () => 'order-3' },
    customerId: 'customer-1',
    createdByUserId: 'portal-1',
    items: [
      { productId: 'product-x', productName: 'X', sku: 'SKU-X', quantity: 2, unitPrice: 7 },
    ],
  };
  const model = { findById: () => execResult(sourceOrder) };
  const productsService = {
    getProductById: async () => ({
      id: 'product-x',
      omschrijving: 'X',
      artikelnummer: 'SKU-X',
      finalPrice: 7,
      basePrice: 7,
      btwPercentage: 21,
      artikelgroepId: 'cat-disabled',
      isActive: true,
    }),
  };
  const categoriesService = {
    getActiveCategoryIds: async () => ['cat-other'],
  };
  const service = createOrdersService(
    model,
    {},
    {},
    {},
    {},
    { log: async () => undefined },
    {},
    productsService,
    {},
    categoriesService,
  );

  const result = await service.reorderOrder('order-3', {
    userId: 'portal-1',
    role: 'customer',
    customerId: 'customer-1',
  });

  assert.equal(result.items.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0].reason, 'category_inactive');
});

test('admin cannot assign super_admin role but can create admin users', async () => {
  const model = {
    findOne: () => execResult(null),
    findById: () => ({ select: () => execResult({ _id: 'admin-1', role: 'admin', permissions: ['users.manage'] }) }),
    create: async (data: any) => ({
      toObject: () => ({ _id: 'new-admin', ...data }),
    }),
  };
  const service = new UsersService(model as any, priceOverridePolicyService);

  await assert.rejects(
    () => service.createUser('new-user', undefined, 'password123', 'super_admin', undefined, undefined, 'admin', 'admin-1'),
    ForbiddenException,
  );
  const created = await service.createUser(
    'new-admin',
    undefined,
    'password123',
    'admin',
    undefined,
    undefined,
    'admin',
    'admin-1',
    ['users.manage'],
  );
  assert.equal((created as any).role, 'admin');
  assert.deepEqual((created as any).permissions, ['users.manage']);
});

test('user DTO password length matches six-character create form rule', async () => {
  const createDto = Object.assign(new CreateUserDto(), {
    username: 'cabir',
    password: '123456',
    role: 'admin',
    permissions: ['users.manage'],
  });
  const updateDto = Object.assign(new UpdateCurrentUserDto(), {
    password: '123456',
  });
  const tooShortCreateDto = Object.assign(new CreateUserDto(), {
    username: 'cabir',
    password: '12345',
    role: 'admin',
  });

  assert.equal((await validate(createDto)).length, 0);
  assert.equal((await validate(updateDto)).length, 0);
  assert.ok((await validate(tooShortCreateDto)).some((error) => error.property === 'password'));
});

test('admin can create customer portal accounts without owning customer default permissions', async () => {
  const adminUser = { _id: 'admin-1', role: 'admin', permissions: ['users.manage'] };
  const model = {
    findOne: () => execResult(null),
    findById: () => ({ select: () => execResult(adminUser) }),
    create: async (data: any) => ({
      toObject: () => ({ _id: 'portal-1', ...data }),
    }),
  };
  const customerModel = {
    findOne: () => ({
      select: () => ({
        lean: () => execResult({ snelstartId: 'customer-1' }),
      }),
    }),
  };
  const service = new UsersService(model as any, priceOverridePolicyService, customerModel as any);

  const created = await service.createUser(
    'portal-user',
    undefined,
    '123456',
    'customer',
    undefined,
    undefined,
    'admin',
    'admin-1',
    undefined,
    'customer-1',
  );

  assert.equal((created as any).role, 'customer');
  assert.equal((created as any).customerId, 'customer-1');
  assert.deepEqual((created as any).permissions, [
    'products.view',
    'products.detail',
    'cart.use',
    'orders.create',
    'orders.my.view',
    'profile.view',
  ]);
});

test('admin cannot update or delete super_admin users', async () => {
  const superAdminUser = { _id: 'user-1', role: 'super_admin' };
  const model = {
    findById: () => execResult(superAdminUser),
  };
  const service = new UsersService(model as any, priceOverridePolicyService);

  await assert.rejects(
    () => service.updateUser('user-1', { username: 'changed' }, true, 'admin'),
    ForbiddenException,
  );
  await assert.rejects(
    () => service.deleteUser('user-1', 'admin'),
    ForbiddenException,
  );
});

test('admin cannot manage equal or higher role users', async () => {
  const adminUser = { _id: 'admin-1', role: 'admin' };
  const model = {
    findById: () => execResult(adminUser),
  };
  const service = new UsersService(model as any, priceOverridePolicyService);

  await assert.rejects(
    () => service.updateUser('admin-1', { username: 'changed' }, true, 'admin'),
    ForbiddenException,
  );
  await assert.rejects(
    () => service.deleteUser('admin-1', 'admin'),
    ForbiddenException,
  );
});

test('permission updates enforce requester permission subset', async () => {
  const salesRepUser = {
    _id: 'sales-1',
    username: 'sales',
    role: 'sales_rep',
    permissions: ['products.view'],
    save: async () => undefined,
    toObject: () => ({
      _id: 'sales-1',
      username: 'sales',
      role: 'sales_rep',
      permissions: ['products.view', 'reports.view'],
    }),
  };
  const adminUser = { _id: 'admin-1', role: 'admin', permissions: ['products.view'] };
  const model = {
    findById: (id: string) => {
      const value = id === 'sales-1' ? salesRepUser : adminUser;
      return {
        select: () => execResult(value),
        exec: async () => value,
      };
    },
  };
  const service = new UsersService(model as any, priceOverridePolicyService);

  await assert.rejects(
    () =>
      service.updateUserPermissions(
        'sales-1',
        ['products.view', 'reports.view'],
        { userId: 'admin-1', role: 'admin' },
      ),
    ForbiddenException,
  );

  const result = await service.updateUserPermissions(
    'sales-1',
    ['products.view'],
    { userId: 'admin-1', role: 'admin' },
  );
  assert.deepEqual(result.newPermissions, ['products.view']);
});

test('super_admin permissions cannot be updated', async () => {
  const superAdminUser = { _id: 'super-1', role: 'super_admin' };
  const model = {
    findById: () => execResult(superAdminUser),
  };
  const service = new UsersService(model as any, priceOverridePolicyService);

  await assert.rejects(
    () =>
      service.updateUserPermissions(
        'super-1',
        [],
        { userId: 'super-1', role: 'super_admin' },
      ),
    ForbiddenException,
  );
});

test('role dropdown hides super_admin option from admin users', () => {
  const createUserPage = fs.readFileSync(path.resolve(process.cwd(), '../web/src/pages/CreateUserPage.tsx'), 'utf8');
  const editUserPage = fs.readFileSync(path.resolve(process.cwd(), '../web/src/pages/EditUserPage.tsx'), 'utf8');

  assert.match(createUserPage, /currentUser\?\.role === 'super_admin'/);
  assert.match(editUserPage, /currentUser\?\.role === 'super_admin'/);
});
