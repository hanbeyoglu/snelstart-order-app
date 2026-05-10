export const ALL_PERMISSIONS = [
  'dashboard.view',
  'products.view',
  'products.detail',
  'products.manage',
  'cart.use',
  'customers.view',
  'customers.wholesalers.view',
  'customers.manage',
  'orders.view',
  'orders.create',
  'orders.my.view',
  'orders.manage',
  'profile.view',
  'pricing.manage',
  'reports.view',
  'audit.view',
  'users.manage',
  'snelstart.settings.manage',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_RANK = {
  customer: 0,
  sales_rep: 1,
  admin: 2,
  super_admin: 3,
} as const;

export const CUSTOMER_DEFAULT_PERMISSIONS: Permission[] = [
  'products.view',
  'products.detail',
  'cart.use',
  'orders.create',
  'orders.my.view',
  'profile.view',
];

export const CUSTOMER_FORBIDDEN_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'products.manage',
  'customers.view',
  'customers.wholesalers.view',
  'customers.manage',
  'orders.view',
  'orders.manage',
  'pricing.manage',
  'reports.view',
  'audit.view',
  'users.manage',
  'snelstart.settings.manage',
];

export function normalizePermissions(permissions: unknown): Permission[] {
  if (!Array.isArray(permissions)) return [];
  const allowed = new Set<string>(ALL_PERMISSIONS);
  return Array.from(
    new Set(
      permissions
        .filter((permission): permission is string => typeof permission === 'string')
        .filter((permission) => allowed.has(permission)),
    ),
  ) as Permission[];
}

export function getEffectivePermissions(role: string, permissions?: unknown): Permission[] {
  if (role === 'super_admin') {
    return [...ALL_PERMISSIONS];
  }
  if (role === 'customer') {
    const forbidden = new Set<string>(CUSTOMER_FORBIDDEN_PERMISSIONS);
    return Array.from(
      new Set([
        ...CUSTOMER_DEFAULT_PERMISSIONS,
        ...normalizePermissions(permissions).filter((permission) => !forbidden.has(permission)),
      ]),
    ) as Permission[];
  }
  return normalizePermissions(permissions);
}
