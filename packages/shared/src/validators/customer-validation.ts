import { z } from 'zod';

export type ValidationIssue = {
  path: Array<string | number>;
  message: string;
};

export const CREATE_CUSTOMER_FIELD_ORDER = [
  'relatiesoort',
  'naam',
  'straat',
  'postcode',
  'plaats',
  'telefoon',
  'email',
  'kvkNummer',
  'btwNummer',
] as const;

export type CreateCustomerFieldName = (typeof CREATE_CUSTOMER_FIELD_ORDER)[number];

export const CUSTOMER_VALIDATION_MESSAGES = {
  required: 'This field is required.',
  relationTypeRequired: 'Please select at least one relation type.',
  invalidEmail: 'Please enter a valid email address.',
  invalidPhone: 'Please enter a valid phone number.',
  invalidBtw: 'Please enter a valid VAT number (e.g. NL123456789B01).',
} as const;

const optionalEmailSchema = z
  .union([z.string().email(CUSTOMER_VALIDATION_MESSAGES.invalidEmail), z.literal('')])
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const optionalPhoneSchema = z
  .union([
    z.string().regex(/^[\d\s+\-()]+$/, CUSTOMER_VALIDATION_MESSAGES.invalidPhone),
    z.literal(''),
  ])
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const optionalBtwSchema = z
  .union([
    z
      .string()
      .regex(/^[A-Z]{2}\d{9}B\d{2}$/, CUSTOMER_VALIDATION_MESSAGES.invalidBtw),
    z.literal(''),
  ])
  .optional()
  .transform((value) => (value === '' ? undefined : value));

export const createCustomerSchema = z.object({
  relatiesoort: z
    .array(z.string(), {
      required_error: CUSTOMER_VALIDATION_MESSAGES.relationTypeRequired,
      invalid_type_error: CUSTOMER_VALIDATION_MESSAGES.relationTypeRequired,
    })
    .min(1, CUSTOMER_VALIDATION_MESSAGES.relationTypeRequired),
  naam: z
    .string({
      required_error: CUSTOMER_VALIDATION_MESSAGES.required,
      invalid_type_error: CUSTOMER_VALIDATION_MESSAGES.required,
    })
    .min(1, CUSTOMER_VALIDATION_MESSAGES.required),
  vestigingsAdres: z.object(
    {
      straat: z
        .string({
          required_error: CUSTOMER_VALIDATION_MESSAGES.required,
          invalid_type_error: CUSTOMER_VALIDATION_MESSAGES.required,
        })
        .min(1, CUSTOMER_VALIDATION_MESSAGES.required),
      postcode: z
        .string({
          required_error: CUSTOMER_VALIDATION_MESSAGES.required,
          invalid_type_error: CUSTOMER_VALIDATION_MESSAGES.required,
        })
        .min(1, CUSTOMER_VALIDATION_MESSAGES.required),
      plaats: z
        .string({
          required_error: CUSTOMER_VALIDATION_MESSAGES.required,
          invalid_type_error: CUSTOMER_VALIDATION_MESSAGES.required,
        })
        .min(1, CUSTOMER_VALIDATION_MESSAGES.required),
      land: z.object({
        id: z
          .string({
            required_error: CUSTOMER_VALIDATION_MESSAGES.required,
            invalid_type_error: CUSTOMER_VALIDATION_MESSAGES.required,
          })
          .min(1, CUSTOMER_VALIDATION_MESSAGES.required),
      }),
    },
    {
      required_error: CUSTOMER_VALIDATION_MESSAGES.required,
      invalid_type_error: CUSTOMER_VALIDATION_MESSAGES.required,
    },
  ),
  telefoon: optionalPhoneSchema,
  email: optionalEmailSchema,
  kvkNummer: z.string().optional(),
  btwNummer: optionalBtwSchema,
});

export const updateCustomerSchema = createCustomerSchema.omit({ relatiesoort: true }).partial();

export function flattenCreateCustomerFieldName(path: (string | number)[]): string {
  const segments = path.map(String);
  if (segments[0] === 'vestigingsAdres' && segments.length > 1) {
    return segments.slice(1).join('.');
  }
  return segments.join('.');
}

export function mapCreateCustomerZodErrors(error: { issues: ValidationIssue[] }): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = flattenCreateCustomerFieldName(issue.path);
    if (!field || errors[field]) {
      continue;
    }
    errors[field] = issue.message === 'Required'
      ? CUSTOMER_VALIDATION_MESSAGES.required
      : issue.message;
  }

  if (errors.vestigingsAdres && !errors.straat) {
    errors.straat = errors.vestigingsAdres;
  }

  return errors;
}

export type CreateCustomerPayload = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerPayload = z.infer<typeof updateCustomerSchema>;

export function buildCreateCustomerPayload(input: {
  relatiesoort: string[];
  naam: string;
  straat: string;
  postcode: string;
  plaats: string;
  landId: string;
  telefoon?: string;
  email?: string;
  kvkNummer?: string;
  btwNummer?: string;
}): CreateCustomerPayload {
  return {
    relatiesoort: input.relatiesoort,
    naam: input.naam.trim(),
    vestigingsAdres: {
      straat: input.straat.trim(),
      postcode: input.postcode.trim(),
      plaats: input.plaats.trim(),
      land: {
        id: input.landId,
      },
    },
    ...(input.telefoon?.trim() ? { telefoon: input.telefoon.trim() } : {}),
    ...(input.email?.trim() ? { email: input.email.trim() } : {}),
    ...(input.kvkNummer?.trim() ? { kvkNummer: input.kvkNummer.trim() } : {}),
    ...(input.btwNummer?.trim() ? { btwNummer: input.btwNummer.trim() } : {}),
  };
}

export function buildUpdateCustomerPayload(input: {
  relatiesoort: string[];
  naam: string;
  straat: string;
  postcode: string;
  plaats: string;
  landId: string;
  telefoon?: string;
  email?: string;
  kvkNummer?: string;
  btwNummer?: string;
}): UpdateCustomerPayload {
  const { relatiesoort: _relatiesoort, ...updatePayload } = buildCreateCustomerPayload(input);
  return updatePayload;
}
