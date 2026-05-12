export const ORDER_NOTIFICATION_EMAIL_LOCALES = ['tr', 'en', 'nl', 'de', 'ar'] as const;
export type OrderNotificationEmailLocale = (typeof ORDER_NOTIFICATION_EMAIL_LOCALES)[number];

export interface OrderNotificationEmailStrings {
  subjectTemplate: string;
  docTitle: string;
  heading: string;
  labelOrderRef: string;
  labelSnelstart: string;
  labelDate: string;
  labelCustomer: string;
  labelCreatedBy: string;
  sectionDelivery: string;
  labelDeliveryType: string;
  labelDeliveryTiming: string;
  labelDeliveryDate: string;
  labelDeliveryAddress: string;
  labelDeliveryNote: string;
  typeWarehouse: string;
  typeMarket: string;
  timingAsap: string;
  timingScheduled: string;
  dateAsap: string;
  sectionLines: string;
  sectionTotals: string;
  labelSubtotalExclVat: string;
  labelVat: string;
  labelTotalInclVat: string;
  labelAdminLink: string;
  noProducts: string;
  currency: string;
  thProduct: string;
  thSku: string;
  thQty: string;
  thUnit: string;
  thLineTotal: string;
  thVat: string;
  vatWord: string;
}

export const ORDER_NOTIFICATION_EMAIL_STRINGS: Record<OrderNotificationEmailLocale, OrderNotificationEmailStrings> = {
  tr: {
    subjectTemplate: 'Yeni sipariş #{orderRef} — {customerName}',
    docTitle: 'Sipariş bildirimi',
    heading: 'YENİ SİPARİŞ BİLDİRİMİ',
    labelOrderRef: 'Sipariş no',
    labelSnelstart: 'SnelStart no',
    labelDate: 'Tarih',
    labelCustomer: 'Müşteri',
    labelCreatedBy: 'Oluşturan',
    sectionDelivery: 'Teslimat bilgileri',
    labelDeliveryType: 'Teslimat tipi',
    labelDeliveryTiming: 'Teslimat zamanı',
    labelDeliveryDate: 'Teslimat tarihi',
    labelDeliveryAddress: 'Teslimat adresi',
    labelDeliveryNote: 'Teslimat notu',
    typeWarehouse: 'Depodan teslim',
    typeMarket: 'Markete teslim',
    timingAsap: 'Hemen',
    timingScheduled: 'İleri tarihli',
    dateAsap: 'Hemen teslim',
    sectionLines: 'Ürün satırları',
    sectionTotals: 'Tutar özeti',
    labelSubtotalExclVat: 'Ara tutar (KDV hariç)',
    labelVat: 'KDV',
    labelTotalInclVat: 'Toplam (KDV dahil)',
    labelAdminLink: 'Admin bağlantısı',
    noProducts: '(ürün yok)',
    currency: '€',
    thProduct: 'Ürün',
    thSku: 'SKU',
    thQty: 'Adet',
    thUnit: 'Birim',
    thLineTotal: 'Satır',
    thVat: 'KDV',
    vatWord: 'KDV',
  },
  en: {
    subjectTemplate: 'New order #{orderRef} — {customerName}',
    docTitle: 'Order notification',
    heading: 'NEW ORDER NOTIFICATION',
    labelOrderRef: 'Order no.',
    labelSnelstart: 'SnelStart no.',
    labelDate: 'Date',
    labelCustomer: 'Customer',
    labelCreatedBy: 'Created by',
    sectionDelivery: 'Delivery information',
    labelDeliveryType: 'Delivery type',
    labelDeliveryTiming: 'Delivery time',
    labelDeliveryDate: 'Delivery date',
    labelDeliveryAddress: 'Delivery address',
    labelDeliveryNote: 'Delivery note',
    typeWarehouse: 'Warehouse pickup',
    typeMarket: 'Market delivery',
    timingAsap: 'As soon as possible',
    timingScheduled: 'Scheduled',
    dateAsap: 'Immediate delivery',
    sectionLines: 'Line items',
    sectionTotals: 'Totals',
    labelSubtotalExclVat: 'Subtotal (excl. VAT)',
    labelVat: 'VAT',
    labelTotalInclVat: 'Total (incl. VAT)',
    labelAdminLink: 'Admin link',
    noProducts: '(no products)',
    currency: '€',
    thProduct: 'Product',
    thSku: 'SKU',
    thQty: 'Qty',
    thUnit: 'Unit',
    thLineTotal: 'Line',
    thVat: 'VAT',
    vatWord: 'VAT',
  },
  nl: {
    subjectTemplate: 'Nieuwe bestelling #{orderRef} — {customerName}',
    docTitle: 'Bestelmelding',
    heading: 'NIEUWE BESTELLING',
    labelOrderRef: 'Bestelnr.',
    labelSnelstart: 'SnelStart-nr.',
    labelDate: 'Datum',
    labelCustomer: 'Klant',
    labelCreatedBy: 'Aangemaakt door',
    sectionDelivery: 'Leveringsinformatie',
    labelDeliveryType: 'Leveringstype',
    labelDeliveryTiming: 'Leveringstijd',
    labelDeliveryDate: 'Leveringsdatum',
    labelDeliveryAddress: 'Leveringsadres',
    labelDeliveryNote: 'Leveringsnotitie',
    typeWarehouse: 'Afhalen magazijn',
    typeMarket: 'Levering aan markt',
    timingAsap: 'Zo snel mogelijk',
    timingScheduled: 'Gepland',
    dateAsap: 'Directe levering',
    sectionLines: 'Orderregels',
    sectionTotals: 'Totalen',
    labelSubtotalExclVat: 'Subtotaal (excl. btw)',
    labelVat: 'Btw',
    labelTotalInclVat: 'Totaal (incl. btw)',
    labelAdminLink: 'Adminlink',
    noProducts: '(geen regels)',
    currency: '€',
    thProduct: 'Product',
    thSku: 'SKU',
    thQty: 'Aantal',
    thUnit: 'Prijs',
    thLineTotal: 'Regel',
    thVat: 'Btw',
    vatWord: 'btw',
  },
  de: {
    subjectTemplate: 'Neue Bestellung #{orderRef} — {customerName}',
    docTitle: 'Bestellbenachrichtigung',
    heading: 'NEUE BESTELLUNG',
    labelOrderRef: 'Bestellnr.',
    labelSnelstart: 'SnelStart-Nr.',
    labelDate: 'Datum',
    labelCustomer: 'Kunde',
    labelCreatedBy: 'Erstellt von',
    sectionDelivery: 'Lieferinformationen',
    labelDeliveryType: 'Lieferart',
    labelDeliveryTiming: 'Lieferzeitpunkt',
    labelDeliveryDate: 'Lieferdatum',
    labelDeliveryAddress: 'Lieferadresse',
    labelDeliveryNote: 'Lieferhinweis',
    typeWarehouse: 'Abholung Lager',
    typeMarket: 'Lieferung zum Markt',
    timingAsap: 'So bald wie möglich',
    timingScheduled: 'Terminiert',
    dateAsap: 'Sofortlieferung',
    sectionLines: 'Positionen',
    sectionTotals: 'Summen',
    labelSubtotalExclVat: 'Zwischensumme (ohne MwSt.)',
    labelVat: 'MwSt.',
    labelTotalInclVat: 'Gesamt (inkl. MwSt.)',
    labelAdminLink: 'Admin-Link',
    noProducts: '(keine Positionen)',
    currency: '€',
    thProduct: 'Artikel',
    thSku: 'SKU',
    thQty: 'Menge',
    thUnit: 'Preis',
    thLineTotal: 'Summe',
    thVat: 'MwSt.',
    vatWord: 'MwSt.',
  },
  ar: {
    subjectTemplate: 'طلب جديد #{orderRef} — {customerName}',
    docTitle: 'إشعار الطلب',
    heading: 'إشعار طلب جديد',
    labelOrderRef: 'رقم الطلب',
    labelSnelstart: 'رقم SnelStart',
    labelDate: 'التاريخ',
    labelCustomer: 'العميل',
    labelCreatedBy: 'أنشأه',
    sectionDelivery: 'معلومات التسليم',
    labelDeliveryType: 'نوع التسليم',
    labelDeliveryTiming: 'توقيت التسليم',
    labelDeliveryDate: 'تاريخ التسليم',
    labelDeliveryAddress: 'عنوان التسليم',
    labelDeliveryNote: 'ملاحظة التسليم',
    typeWarehouse: 'استلام من المستودع',
    typeMarket: 'تسليم إلى السوق',
    timingAsap: 'في أقرب وقت',
    timingScheduled: 'مجدول',
    dateAsap: 'تسليم فوري',
    sectionLines: 'بنود الطلب',
    sectionTotals: 'الإجماليات',
    labelSubtotalExclVat: 'المجموع الفرعي (بدون ضريبة)',
    labelVat: 'الضريبة',
    labelTotalInclVat: 'الإجمالي (شامل الضريبة)',
    labelAdminLink: 'رابط الإدارة',
    noProducts: '(لا توجد بنود)',
    currency: '€',
    thProduct: 'المنتج',
    thSku: 'SKU',
    thQty: 'الكمية',
    thUnit: 'السعر',
    thLineTotal: 'الإجمالي',
    thVat: 'الضريبة',
    vatWord: 'ض.ق.م.',
  },
};

export function normalizeOrderNotificationLocale(raw?: string | null): OrderNotificationEmailLocale {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'en' || v.startsWith('en')) return 'en';
  if (v === 'nl' || v.startsWith('nl')) return 'nl';
  if (v === 'de' || v.startsWith('de')) return 'de';
  if (v === 'ar' || v.startsWith('ar')) return 'ar';
  if (v === 'tr' || v.startsWith('tr')) return 'tr';
  return 'tr';
}

export function intlLocaleTagForEmail(locale: OrderNotificationEmailLocale): string {
  const map: Record<OrderNotificationEmailLocale, string> = {
    tr: 'tr-TR',
    en: 'en-GB',
    nl: 'nl-NL',
    de: 'de-DE',
    ar: 'ar',
  };
  return map[locale];
}
