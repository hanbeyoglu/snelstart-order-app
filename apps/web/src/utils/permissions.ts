import type { ReactNode } from 'react';

/** Sıralı liste — backend `ALL_PERMISSIONS` ile aynı tutulmalı */
export const ALL_PERMISSIONS_ORDER = [
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
  'orders.email.send',
  'profile.view',
  'pricing.manage',
  'price.override.full',
  'price.override.limited',
  'reports.view',
  'audit.view',
  'users.manage',
  'snelstart.settings.manage',
  'mail.settings.view',
  'mail.settings.manage',
  'mail.test.send',
  'order.notifications.manage',
] as const;

/** Portal (customer) hesapları için sunucunun her zaman eklediği varsayılanlar */
export const CUSTOMER_DEFAULT_PERMISSIONS: readonly string[] = [
  'products.view',
  'products.detail',
  'cart.use',
  'orders.create',
  'orders.my.view',
  'profile.view',
];

/** Müşteri rolüne asla verilemeyen izinler (backend `CUSTOMER_FORBIDDEN` ile aynı) */
export const CUSTOMER_FORBIDDEN_PERMISSIONS: readonly string[] = [
  'dashboard.view',
  'products.manage',
  'customers.view',
  'customers.wholesalers.view',
  'customers.manage',
  'orders.view',
  'orders.manage',
  'orders.email.send',
  'pricing.manage',
  'price.override.full',
  'price.override.limited',
  'reports.view',
  'audit.view',
  'users.manage',
  'snelstart.settings.manage',
  'mail.settings.view',
  'mail.settings.manage',
  'mail.test.send',
  'order.notifications.manage',
];

const PERMISSION_ORDER_MAP = new Map<string, number>(
  ALL_PERMISSIONS_ORDER.map((permission, index) => [permission, index]),
);

/** Yöneticinin atayabileceği katalogdan portal için gösterilecek izinler */
export function getPortalAssignablePermissions(catalog: string[]): string[] {
  const forbidden = new Set(CUSTOMER_FORBIDDEN_PERMISSIONS);
  return catalog
    .filter((permission) => !forbidden.has(permission))
    .sort((a, b) => (PERMISSION_ORDER_MAP.get(a) ?? 999) - (PERMISSION_ORDER_MAP.get(b) ?? 999));
}

export function normalizePortalPermissionSelection(selected: string[], catalog: string[]): string[] {
  const allowed = new Set(catalog);
  return [
    ...new Set([...CUSTOMER_DEFAULT_PERMISSIONS, ...selected.filter((permission) => allowed.has(permission))]),
  ];
}

export const PERMISSION_LABELS: Record<string, string> = {
  'dashboard.view': 'Ana Dashboard',
  'products.view': 'Ürünleri Görüntüleme',
  'products.detail': 'Ürün Detayı',
  'products.manage': 'Ürünleri Yönetme',
  'cart.use': 'Sepet Kullanımı',
  'customers.view': 'Müşterileri Görüntüleme',
  'customers.wholesalers.view': 'Toptancıları Görüntüleme',
  'customers.manage': 'Müşterileri Yönetme',
  'orders.view': 'Siparişleri Görüntüleme',
  'orders.create': 'Sipariş Oluşturma',
  'orders.my.view': 'Kendi Siparişlerini Görüntüleme',
  'orders.manage': 'Siparişleri Yönetme',
  'orders.email.send': 'Müşteriye Sipariş Maili Gönderme',
  'profile.view': 'Profil Görüntüleme',
  'pricing.manage': 'Fiyat Yönetimi',
  'price.override.full': 'Sınırsız fiyat değiştirme',
  'price.override.limited': 'Limitli fiyat değiştirme',
  'reports.view': 'Raporları Görüntüleme',
  'audit.view': 'Audit Log Görüntüleme',
  'users.manage': 'Kullanıcı Yönetimi',
  'snelstart.settings.manage': 'SnelStart Ayarları',
  'mail.settings.view': 'Mail Ayarlarını Görüntüleme',
  'mail.settings.manage': 'Mail Ayarlarını Yönetme',
  'mail.test.send': 'Test Mail Gönderme',
  'order.notifications.manage': 'Sipariş Bildirimlerini Yönetme',
};

export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  'dashboard.view': 'Ana paneldeki özet metrikleri ve hızlı genel durumu görür.',
  'products.view': 'Ürün, kategori ve ürün detay sayfalarını görüntüler.',
  'products.detail': 'Ürün detay sayfasını görüntüler.',
  'products.manage': 'Ürün/kategori görünürlüğünü ve ürün görsellerini yönetir.',
  'cart.use': 'Sepete ürün ekler ve sepeti görüntüler.',
  'customers.view': 'Müşteri listesini ve müşteri detaylarını görüntüler.',
  'customers.wholesalers.view': 'Müşteri listesinde toptancı kayıtlarını da görüntüler.',
  'customers.manage': 'Yeni müşteri oluşturur ve mevcut müşteri bilgilerini düzenler.',
  'orders.view': 'Sipariş listesini ve sipariş detaylarını görüntüler.',
  'orders.create': 'Sepeti kullanır ve müşteri adına sipariş oluşturur.',
  'orders.my.view': 'Sadece kendi müşteri kaydına ait siparişleri görüntüler.',
  'orders.manage': 'Sipariş süreçlerinde yönetim seviyesindeki işlemleri yapar.',
  'orders.email.send': 'Senkronize siparişler için müşteriye onay e-postası gönderir.',
  'profile.view': 'Kendi profil sayfasını görüntüler.',
  'pricing.manage': 'Fiyat yönetimi ekranlarını ve fiyat uyarılarını kullanır.',
  'price.override.full': 'Ürün satış fiyatını herhangi bir değere değiştirebilir.',
  'price.override.limited': 'Tanımlı yüzde limiti içinde fiyat değiştirebilir.',
  'reports.view': 'Raporlama ekranındaki satış ve ürün analizlerini görüntüler.',
  'audit.view': 'Sistemdeki audit log kayıtlarını görüntüler.',
  'users.manage': 'Kullanıcı oluşturur, düzenler ve izin ataması yapar.',
  'snelstart.settings.manage': 'SnelStart bağlantı ayarlarını ve entegrasyon işlemlerini yönetir.',
  'mail.settings.view': 'SMTP ve bildirim mail ayarlarını görüntüler.',
  'mail.settings.manage': 'SMTP sunucu yapılandırmasını düzenler.',
  'mail.test.send': 'SMTP ayarlarını doğrulamak için test maili gönderir.',
  'order.notifications.manage': 'Sipariş bildirimlerinin gönderileceği To/CC adreslerini yönetir.',
};

export type PermissionUser = {
  role: 'customer' | 'sales_rep' | 'admin' | 'super_admin';
  permissions?: string[];
} | null | undefined;

export function hasPermission(user: PermissionUser, permission: string) {
  if (user?.role === 'super_admin') return true;
  return user?.permissions?.includes(permission) || false;
}

export function hasAnyPermission(user: PermissionUser, permissions: string[]) {
  if (user?.role === 'super_admin') return true;
  return permissions.some((permission) => hasPermission(user, permission));
}

export function canManagePermissions(user: PermissionUser) {
  return user?.role === 'super_admin' || (user?.role === 'admin' && hasPermission(user, 'users.manage'));
}

export function PermissionRoute({
  user,
  permission,
  children,
  fallback,
}: {
  user: PermissionUser;
  permission: string;
  children: ReactNode;
  fallback: ReactNode;
}) {
  return hasPermission(user, permission) ? children : fallback;
}
