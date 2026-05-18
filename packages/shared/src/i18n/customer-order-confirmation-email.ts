import {
  ORDER_NOTIFICATION_EMAIL_LOCALES,
  intlLocaleTagForEmail,
  normalizeOrderNotificationLocale,
  type OrderNotificationEmailLocale,
} from './order-notification-email';

export { ORDER_NOTIFICATION_EMAIL_LOCALES, intlLocaleTagForEmail, normalizeOrderNotificationLocale };
export type CustomerOrderConfirmationLocale = OrderNotificationEmailLocale;

export interface CustomerOrderConfirmationEmailStrings {
  subjectTemplate: string;
  docTitle: string;
  greeting: string;
  intro: string;
  labelOrderNumber: string;
  labelOrderDate: string;
  sectionDelivery: string;
  labelDeliveryType: string;
  labelDeliveryTiming: string;
  labelDeliveryDate: string;
  labelDeliveryAddress: string;
  sectionOrderNote: string;
  labelOrderNote: string;
  sectionLines: string;
  sectionTotals: string;
  labelSubtotalExclVat: string;
  labelVat: string;
  labelVatTotal: string;
  labelTotalInclVat: string;
  sectionVatBreakdown: string;
  thankYou: string;
  footer: string;
  typeWarehouse: string;
  typeMarket: string;
  timingAsap: string;
  timingScheduled: string;
  dateAsap: string;
  noProducts: string;
  currency: string;
  thProduct: string;
  thSku: string;
  thQty: string;
  thUnit: string;
  thLineTotal: string;
  thVat: string;
  thUnitExclVat: string;
  thLineExclVat: string;
  thVatPct: string;
  thVatAmount: string;
  thLineInclVat: string;
  thBreakdownRate: string;
  thBreakdownSubtotal: string;
  thBreakdownVat: string;
  thBreakdownTotal: string;
  vatWord: string;
  vatRateRow: string;
}

export const CUSTOMER_ORDER_CONFIRMATION_EMAIL_STRINGS: Record<
  CustomerOrderConfirmationLocale,
  CustomerOrderConfirmationEmailStrings
> = {
  tr: {
    subjectTemplate: 'Siparişiniz alındı - {orderNumber}',
    docTitle: 'Sipariş onayı',
    greeting: 'Merhaba {customerName},',
    intro: 'Siparişiniz başarıyla alındı. Özet bilgiler aşağıdadır.',
    labelOrderNumber: 'Sipariş no',
    labelOrderDate: 'Sipariş tarihi',
    sectionDelivery: 'Teslimat bilgileri',
    labelDeliveryType: 'Teslimat tipi',
    labelDeliveryTiming: 'Teslimat zamanı',
    labelDeliveryDate: 'Teslimat tarihi',
    labelDeliveryAddress: 'Teslimat adresi',
    sectionOrderNote: 'Sipariş notu',
    labelOrderNote: 'Not',
    sectionLines: 'Ürünler',
    sectionTotals: 'Tutar özeti',
    labelSubtotalExclVat: 'Ara tutar (KDV hariç)',
    labelVat: 'KDV',
    labelVatTotal: 'KDV toplamı',
    labelTotalInclVat: 'Toplam (KDV dahil)',
    sectionVatBreakdown: 'KDV dökümü',
    thankYou: 'Bizi tercih ettiğiniz için teşekkür ederiz.',
    footer: 'Bu e-posta sipariş onayınız içindir. Sorularınız için lütfen bizimle iletişime geçin.',
    typeWarehouse: 'Depodan teslim',
    typeMarket: 'Markete teslim',
    timingAsap: 'Hemen',
    timingScheduled: 'İleri tarihli',
    dateAsap: 'Hemen teslim',
    noProducts: '(ürün yok)',
    currency: '€',
    thProduct: 'Ürün',
    thSku: 'SKU',
    thQty: 'Adet',
    thUnit: 'Birim',
    thLineTotal: 'Satır',
    thVat: 'KDV',
    thUnitExclVat: 'Birim (KDV hariç)',
    thLineExclVat: 'Satır (KDV hariç)',
    thVatPct: 'KDV %',
    thVatAmount: 'KDV tutarı',
    thLineInclVat: 'Satır (KDV dahil)',
    thBreakdownRate: 'Oran',
    thBreakdownSubtotal: 'Ara tutar',
    thBreakdownVat: 'KDV',
    thBreakdownTotal: 'Toplam',
    vatWord: 'KDV',
    vatRateRow: 'KDV %{rate}',
  },
  en: {
    subjectTemplate: 'Your order has been received - {orderNumber}',
    docTitle: 'Order confirmation',
    greeting: 'Hello {customerName},',
    intro: 'Your order has been received successfully. Summary below.',
    labelOrderNumber: 'Order no.',
    labelOrderDate: 'Order date',
    sectionDelivery: 'Delivery information',
    labelDeliveryType: 'Delivery type',
    labelDeliveryTiming: 'Delivery time',
    labelDeliveryDate: 'Delivery date',
    labelDeliveryAddress: 'Delivery address',
    sectionOrderNote: 'Order note',
    labelOrderNote: 'Note',
    sectionLines: 'Products',
    sectionTotals: 'Totals',
    labelSubtotalExclVat: 'Subtotal (excl. VAT)',
    labelVat: 'VAT',
    labelVatTotal: 'VAT total',
    labelTotalInclVat: 'Total (incl. VAT)',
    sectionVatBreakdown: 'VAT breakdown',
    thankYou: 'Thank you for your order.',
    footer: 'This email confirms your order. Please contact us if you have any questions.',
    typeWarehouse: 'Warehouse pickup',
    typeMarket: 'Market delivery',
    timingAsap: 'As soon as possible',
    timingScheduled: 'Scheduled',
    dateAsap: 'Immediate delivery',
    noProducts: '(no products)',
    currency: '€',
    thProduct: 'Product',
    thSku: 'SKU',
    thQty: 'Qty',
    thUnit: 'Unit',
    thLineTotal: 'Line',
    thVat: 'VAT',
    thUnitExclVat: 'Unit excl. VAT',
    thLineExclVat: 'Line excl. VAT',
    thVatPct: 'VAT %',
    thVatAmount: 'VAT amount',
    thLineInclVat: 'Line incl. VAT',
    thBreakdownRate: 'Rate',
    thBreakdownSubtotal: 'Subtotal',
    thBreakdownVat: 'VAT',
    thBreakdownTotal: 'Total',
    vatWord: 'VAT',
    vatRateRow: 'VAT %{rate}%',
  },
  nl: {
    subjectTemplate: 'Uw bestelling is ontvangen - {orderNumber}',
    docTitle: 'Bestelbevestiging',
    greeting: 'Beste {customerName},',
    intro: 'Uw bestelling is succesvol ontvangen. Hieronder vindt u het overzicht.',
    labelOrderNumber: 'Bestelnr.',
    labelOrderDate: 'Besteldatum',
    sectionDelivery: 'Leveringsinformatie',
    labelDeliveryType: 'Leveringstype',
    labelDeliveryTiming: 'Leveringstijd',
    labelDeliveryDate: 'Leveringsdatum',
    labelDeliveryAddress: 'Leveringsadres',
    sectionOrderNote: 'Bestelnotitie',
    labelOrderNote: 'Notitie',
    sectionLines: 'Producten',
    sectionTotals: 'Totalen',
    labelSubtotalExclVat: 'Subtotaal (excl. btw)',
    labelVat: 'Btw',
    labelVatTotal: 'Btw totaal',
    labelTotalInclVat: 'Totaal (incl. btw)',
    sectionVatBreakdown: 'Btw-specificatie',
    thankYou: 'Bedankt voor uw bestelling.',
    footer: 'Deze e-mail bevestigt uw bestelling. Neem contact met ons op bij vragen.',
    typeWarehouse: 'Afhalen magazijn',
    typeMarket: 'Levering aan markt',
    timingAsap: 'Zo snel mogelijk',
    timingScheduled: 'Gepland',
    dateAsap: 'Directe levering',
    noProducts: '(geen regels)',
    currency: '€',
    thProduct: 'Product',
    thSku: 'SKU',
    thQty: 'Aantal',
    thUnit: 'Prijs',
    thLineTotal: 'Regel',
    thVat: 'Btw',
    thUnitExclVat: 'Eenheid excl. btw',
    thLineExclVat: 'Regel excl. btw',
    thVatPct: 'Btw %',
    thVatAmount: 'Btw bedrag',
    thLineInclVat: 'Regel incl. btw',
    thBreakdownRate: 'Tarief',
    thBreakdownSubtotal: 'Subtotaal',
    thBreakdownVat: 'Btw',
    thBreakdownTotal: 'Totaal',
    vatWord: 'btw',
    vatRateRow: 'Btw %{rate}%',
  },
  de: {
    subjectTemplate: 'Ihre Bestellung wurde erhalten - {orderNumber}',
    docTitle: 'Bestellbestätigung',
    greeting: 'Guten Tag {customerName},',
    intro: 'Ihre Bestellung wurde erfolgreich erhalten. Zusammenfassung unten.',
    labelOrderNumber: 'Bestellnr.',
    labelOrderDate: 'Bestelldatum',
    sectionDelivery: 'Lieferinformationen',
    labelDeliveryType: 'Lieferart',
    labelDeliveryTiming: 'Lieferzeitpunkt',
    labelDeliveryDate: 'Lieferdatum',
    labelDeliveryAddress: 'Lieferadresse',
    sectionOrderNote: 'Bestellnotiz',
    labelOrderNote: 'Notiz',
    sectionLines: 'Artikel',
    sectionTotals: 'Summen',
    labelSubtotalExclVat: 'Zwischensumme (ohne MwSt.)',
    labelVat: 'MwSt.',
    labelVatTotal: 'MwSt. gesamt',
    labelTotalInclVat: 'Gesamt (inkl. MwSt.)',
    sectionVatBreakdown: 'MwSt.-Aufschlüsselung',
    thankYou: 'Vielen Dank für Ihre Bestellung.',
    footer: 'Diese E-Mail bestätigt Ihre Bestellung. Bei Fragen kontaktieren Sie uns bitte.',
    typeWarehouse: 'Abholung Lager',
    typeMarket: 'Lieferung zum Markt',
    timingAsap: 'So bald wie möglich',
    timingScheduled: 'Terminiert',
    dateAsap: 'Sofortlieferung',
    noProducts: '(keine Positionen)',
    currency: '€',
    thProduct: 'Artikel',
    thSku: 'SKU',
    thQty: 'Menge',
    thUnit: 'Preis',
    thLineTotal: 'Summe',
    thVat: 'MwSt.',
    thUnitExclVat: 'Einzelpreis o. MwSt.',
    thLineExclVat: 'Zeile o. MwSt.',
    thVatPct: 'MwSt. %',
    thVatAmount: 'MwSt.-Betrag',
    thLineInclVat: 'Zeile inkl. MwSt.',
    thBreakdownRate: 'Satz',
    thBreakdownSubtotal: 'Zwischensumme',
    thBreakdownVat: 'MwSt.',
    thBreakdownTotal: 'Gesamt',
    vatWord: 'MwSt.',
    vatRateRow: 'MwSt. %{rate}%',
  },
  ar: {
    subjectTemplate: 'تم استلام طلبك - {orderNumber}',
    docTitle: 'تأكيد الطلب',
    greeting: 'مرحباً {customerName}،',
    intro: 'تم استلام طلبك بنجاح. الملخص أدناه.',
    labelOrderNumber: 'رقم الطلب',
    labelOrderDate: 'تاريخ الطلب',
    sectionDelivery: 'معلومات التسليم',
    labelDeliveryType: 'نوع التسليم',
    labelDeliveryTiming: 'وقت التسليم',
    labelDeliveryDate: 'تاريخ التسليم',
    labelDeliveryAddress: 'عنوان التسليم',
    sectionOrderNote: 'ملاحظة الطلب',
    labelOrderNote: 'ملاحظة',
    sectionLines: 'المنتجات',
    sectionTotals: 'الإجماليات',
    labelSubtotalExclVat: 'المجموع الفرعي (بدون ضريبة)',
    labelVat: 'ضريبة القيمة المضافة',
    labelVatTotal: 'إجمالي الضريبة',
    labelTotalInclVat: 'الإجمالي (شامل الضريبة)',
    sectionVatBreakdown: 'تفصيل الضريبة',
    thankYou: 'شكراً لطلبكم.',
    footer: 'هذا البريد يؤكد طلبكم. تواصلوا معنا لأي استفسار.',
    typeWarehouse: 'استلام من المستودع',
    typeMarket: 'تسليم للسوق',
    timingAsap: 'في أقرب وقت',
    timingScheduled: 'مجدول',
    dateAsap: 'تسليم فوري',
    noProducts: '(لا منتجات)',
    currency: '€',
    thProduct: 'منتج',
    thSku: 'SKU',
    thQty: 'الكمية',
    thUnit: 'السعر',
    thLineTotal: 'السطر',
    thVat: 'ض.ق.م',
    thUnitExclVat: 'سعر الوحدة بدون ضريبة',
    thLineExclVat: 'السطر بدون ضريبة',
    thVatPct: 'نسبة الضريبة',
    thVatAmount: 'مبلغ الضريبة',
    thLineInclVat: 'السطر شامل الضريبة',
    thBreakdownRate: 'النسبة',
    thBreakdownSubtotal: 'المجموع الفرعي',
    thBreakdownVat: 'الضريبة',
    thBreakdownTotal: 'الإجمالي',
    vatWord: 'ض.ق.م',
    vatRateRow: 'ضريبة %{rate}%',
  },
};
