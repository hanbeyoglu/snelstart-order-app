export type VatBreakdownRow = {
  vatRate: number;
  subtotalExclVat: number;
  vatAmount: number;
  totalInclVat: number;
};

export type OrderLineTotals = {
  unitExclVat: number;
  lineExclVat: number;
  vatRate: number;
  vatAmount: number;
  lineInclVat: number;
};

export type ResolvedOrderTotals = {
  subtotalExclVat: number;
  vatAmount: number;
  totalInclVat: number;
  vatBreakdown: VatBreakdownRow[];
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number): string {
  return money(value).toFixed(2);
}

export function getParentOrderItems(order: { items?: unknown[] }): any[] {
  return (order.items || []).filter((item: any) => !item?.isChildItem);
}

function getItemVatRate(item: any): number {
  const rate = Number(item?.vatRate ?? item?.vatPercentage ?? item?.btwPercentage ?? 0);
  return Number.isFinite(rate) && rate >= 0 ? rate : 0;
}

export function getOrderLineTotals(item: any): OrderLineTotals {
  const qty = Number(item?.quantity ?? 0);
  const unitExclVat = money(
    Number(
      item?.unitPriceExclVat ??
        item?.unitPrice ??
        (qty > 0 && typeof item?.lineSubtotalExclVat === 'number'
          ? item.lineSubtotalExclVat / qty
          : 0),
    ),
  );
  const lineExclVat = money(
    typeof item?.lineSubtotalExclVat === 'number'
      ? item.lineSubtotalExclVat
      : typeof item?.subtotalExclVat === 'number'
        ? item.subtotalExclVat
        : unitExclVat * qty,
  );
  const vatRate = getItemVatRate(item);
  const vatAmount = money(
    typeof item?.lineVatAmount === 'number'
      ? item.lineVatAmount
      : typeof item?.vatAmount === 'number'
        ? item.vatAmount
        : (lineExclVat * vatRate) / 100,
  );
  const lineInclVat = money(
    typeof item?.lineTotalInclVat === 'number'
      ? item.lineTotalInclVat
      : typeof item?.totalInclVat === 'number'
        ? item.totalInclVat
        : lineExclVat + vatAmount,
  );

  return { unitExclVat, lineExclVat, vatRate, vatAmount, lineInclVat };
}

function buildVatBreakdownFromItems(parentItems: any[]): VatBreakdownRow[] {
  const byRate = new Map<number, VatBreakdownRow>();

  for (const item of parentItems) {
    const line = getOrderLineTotals(item);
    const current = byRate.get(line.vatRate) || {
      vatRate: line.vatRate,
      subtotalExclVat: 0,
      vatAmount: 0,
      totalInclVat: 0,
    };
    current.subtotalExclVat = money(current.subtotalExclVat + line.lineExclVat);
    current.vatAmount = money(current.vatAmount + line.vatAmount);
    current.totalInclVat = money(current.totalInclVat + line.lineInclVat);
    byRate.set(line.vatRate, current);
  }

  return Array.from(byRate.values()).sort((a, b) => a.vatRate - b.vatRate);
}

function normalizeVatBreakdown(rows: unknown): VatBreakdownRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row: any) => ({
      vatRate: Number(row?.vatRate ?? 0),
      subtotalExclVat: money(Number(row?.subtotalExclVat ?? 0)),
      vatAmount: money(Number(row?.vatAmount ?? 0)),
      totalInclVat: money(Number(row?.totalInclVat ?? 0)),
    }))
    .filter((row) => Number.isFinite(row.vatRate))
    .sort((a, b) => a.vatRate - b.vatRate);
}

export function resolveCustomerOrderTotals(order: any): ResolvedOrderTotals {
  const parentItems = getParentOrderItems(order);
  const fromItems = buildVatBreakdownFromItems(parentItems);

  let subtotalExclVat =
    typeof order?.subtotalExclVat === 'number'
      ? money(order.subtotalExclVat)
      : typeof order?.subtotal === 'number'
        ? money(order.subtotal)
        : null;
  let vatAmount =
    typeof order?.vatAmount === 'number'
      ? money(order.vatAmount)
      : typeof order?.vatTotal === 'number'
        ? money(order.vatTotal)
        : null;
  let totalInclVat =
    typeof order?.totalInclVat === 'number'
      ? money(order.totalInclVat)
      : typeof order?.total === 'number'
        ? money(order.total)
        : null;

  if (vatAmount == null) {
    vatAmount = money(parentItems.reduce((sum, item) => sum + getOrderLineTotals(item).vatAmount, 0));
  }
  if (subtotalExclVat == null) {
    subtotalExclVat = money(
      parentItems.reduce((sum, item) => sum + getOrderLineTotals(item).lineExclVat, 0),
    );
  }
  if (totalInclVat == null) {
    totalInclVat = money(subtotalExclVat + vatAmount);
  }

  const storedBreakdown = normalizeVatBreakdown(order?.vatBreakdown);
  const vatBreakdown = storedBreakdown.length > 0 ? storedBreakdown : fromItems;

  return {
    subtotalExclVat,
    vatAmount,
    totalInclVat,
    vatBreakdown,
  };
}

export { formatMoney, money };
