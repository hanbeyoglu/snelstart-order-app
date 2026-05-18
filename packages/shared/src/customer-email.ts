const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

function collectRawEmailStrings(customer: Record<string, unknown> | null | undefined): string[] {
  if (!customer) return [];
  const candidates: unknown[] = [
    customer.email,
    customer.Email,
    customer.confirmEmail,
    customer.confirmationEmail,
    customer.orderEmail,
    customer.bestellingEmail,
    customer.bevestigingsEmail,
    customer.bevestigingEmail,
  ];
  const extra = customer.extraVelden;
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    const ev = extra as Record<string, unknown>;
    candidates.push(
      ev.email,
      ev.confirmEmail,
      ev.confirmationEmail,
      ev.orderEmail,
      ev.bevestigingsEmail,
    );
  }
  return candidates.flatMap((value) => {
    if (value == null) return [];
    if (Array.isArray(value)) return value.map((v) => String(v));
    return String(value)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  });
}

/** Resolve unique valid customer-facing email addresses (trim, lowercase, comma-separated). */
export function resolveCustomerEmails(customer: Record<string, unknown> | null | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of collectRawEmailStrings(customer)) {
    const email = cleanEmail(raw);
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }
  return result;
}

export function customerHasValidEmail(customer: Record<string, unknown> | null | undefined): boolean {
  return resolveCustomerEmails(customer).length > 0;
}
