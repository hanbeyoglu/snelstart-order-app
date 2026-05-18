export const ORDER_NOTE_MAX_LENGTH = 1000;
export const SNELSTART_ORDER_NOTE_OMSCHRIJVING = 'Portal bestelling bevat klantnotitie';

export interface SnelStartMemoOrderInput {
  note?: string | null;
  deliveryType?: 'warehouse_pickup' | 'market_delivery' | null;
  deliveryTiming?: 'asap' | 'scheduled' | null;
  deliveryDate?: Date | string | null;
  createdByRole?: string | null;
  createdByFullName?: string | null;
  createdByUsername?: string | null;
  createdByCustomerName?: string | null;
  createdByCustomerId?: string | null;
}

/** Strip HTML/script and normalize optional order notes to plain text. */
export function sanitizeOrderNote(value: string | undefined | null): string | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;

  const withoutHtml = trimmed.replace(/<[^>]*>/g, '');
  const plain = withoutHtml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  const limited = plain.slice(0, ORDER_NOTE_MAX_LENGTH).trim();
  return limited || undefined;
}

/** Build short SnelStart verkooporder.omschrijving indicator for orders with notes. */
export function buildSnelStartOrderOmschrijving(order: SnelStartMemoOrderInput): string | undefined {
  return sanitizeOrderNote(order.note ?? undefined) ? SNELSTART_ORDER_NOTE_OMSCHRIJVING : undefined;
}

function formatDeliveryDateForMemo(
  timing?: string | null,
  deliveryDate?: Date | string | null,
): string | undefined {
  if (timing === 'asap') return 'Directe levering';
  if (timing === 'scheduled' && deliveryDate) {
    const parsed = deliveryDate instanceof Date ? deliveryDate : new Date(deliveryDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  if (timing === 'scheduled') return 'Geplande levering';
  return undefined;
}

function resolveCreatedByLine(order: SnelStartMemoOrderInput): string | undefined {
  if (order.createdByRole === 'customer') {
    return (
      order.createdByCustomerName ||
      order.createdByCustomerId ||
      undefined
    );
  }
  return order.createdByFullName || order.createdByUsername || undefined;
}

/** Build SnelStart verkooporder.memo from stored order fields (plain text). */
export function buildSnelStartOrderMemo(order: SnelStartMemoOrderInput): string {
  const sections: string[] = [];

  const note = sanitizeOrderNote(order.note ?? undefined);
  if (note) {
    sections.push(`Klantnotitie:\n${note}`);
  }

  const deliveryLines: string[] = [];
  if (order.deliveryType === 'warehouse_pickup') {
    deliveryLines.push('- Type: Afhalen magazijn');
  } else if (order.deliveryType === 'market_delivery') {
    deliveryLines.push('- Type: Levering aan markt');
  }

  const deliveryDateLabel = formatDeliveryDateForMemo(order.deliveryTiming, order.deliveryDate);
  if (deliveryDateLabel) {
    deliveryLines.push(`- Datum: ${deliveryDateLabel}`);
  } else if (order.deliveryType && order.deliveryTiming) {
    deliveryLines.push('- Datum: Directe levering');
  }

  if (deliveryLines.length > 0) {
    sections.push(`Levering:\n${deliveryLines.join('\n')}`);
  }

  const creatorLine = resolveCreatedByLine(order);
  if (creatorLine) {
    sections.push(`Aangemaakt door:\n${creatorLine}`);
  }

  if (sections.length === 0) {
    return creatorLine ? `Aangemaakt door:\n${creatorLine}` : 'Aangemaakt door:\nOnbekend';
  }

  return sections.join('\n\n');
}
