/**
 * Search normalization: lowercase, trim, strip non letters/digits (Unicode),
 * so e.g. "red-bull" and "red bull" both become "redbull".
 */
export function normalizeForSearch(text: string): string {
  const raw = (text || '').normalize('NFKC').trim().toLowerCase();
  return raw.replace(/[^\p{L}\p{N}]+/gu, '');
}

function stringifyExtraWaarde(waarde: unknown): string {
  if (waarde == null) return '';
  if (typeof waarde === 'number' && Number.isFinite(waarde)) return String(waarde);
  return String(waarde);
}

/** SnelStart-style extraVelden rows: pull GTIN / EAN / UPC-ish codes for search indexing. */
export function extraVeldenValuesForSearch(extraVelden: unknown): string[] {
  if (!Array.isArray(extraVelden)) return [];
  const out: string[] = [];
  for (const row of extraVelden) {
    const naam = row?.naam != null ? String(row.naam).trim() : '';
    const waarde = stringifyExtraWaarde(row?.waarde).trim();
    if (!naam || !waarde) continue;
    const n = naam.toLowerCase();
    const isGtinLike =
      n.includes('gtin') ||
      /\bean\b/.test(n) ||
      n.startsWith('ean') ||
      n.includes('_ean') ||
      n.includes('ean_') ||
      n === 'barcode' ||
      n.includes('upc') ||
      n.includes('inkoopbarcode') ||
      n.includes('verkoopbarcode');
    if (isGtinLike) out.push(waarde);
  }
  return out;
}

export type ProductSearchSource = {
  omschrijving?: string | null;
  artikelcode?: string | null;
  artikelnummer?: string | null;
  barcode?: string | null;
  extraVelden?: unknown;
};

export function buildNormalizedSearchTextFromProductFields(input: ProductSearchSource): string {
  const chunks: string[] = [
    input.omschrijving || '',
    input.artikelcode || '',
    input.artikelnummer || '',
    input.barcode || '',
    ...extraVeldenValuesForSearch(input.extraVelden),
  ];
  return normalizeForSearch(chunks.join(' '));
}

/** Raw artikel payload from SnelStart (id, not snelstartId). */
export function buildNormalizedSearchTextFromApiProduct(product: Record<string, unknown>): string {
  return buildNormalizedSearchTextFromProductFields({
    omschrijving: product.omschrijving as string | undefined,
    artikelcode: product.artikelcode as string | undefined,
    artikelnummer: product.artikelnummer as string | undefined,
    barcode: product.barcode as string | undefined,
    extraVelden: product.extraVelden,
  });
}
