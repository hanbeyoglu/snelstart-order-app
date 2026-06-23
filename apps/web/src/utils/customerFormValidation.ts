import {
  CREATE_CUSTOMER_FIELD_ORDER,
  buildCreateCustomerPayload,
  buildUpdateCustomerPayload,
  createCustomerSchema,
  mapCreateCustomerZodErrors,
  type CreateCustomerFieldName,
  type CreateCustomerPayload,
  type UpdateCustomerPayload,
} from '@snelstart-order-app/shared/validators/customer-validation';

export type CreateCustomerFormData = {
  relatiesoort: string[];
  naam: string;
  straat: string;
  postcode: string;
  plaats: string;
  landId: string;
  telefoon: string;
  email: string;
  kvkNummer: string;
  btwNummer: string;
};

const FIELD_I18N_KEYS: Partial<Record<CreateCustomerFieldName, string>> = {
  relatiesoort: 'validation:relationTypeRequired',
  naam: 'validation:customerNameRequired',
  straat: 'validation:streetRequired',
  postcode: 'validation:postalCodeRequired',
  plaats: 'validation:cityRequired',
  telefoon: 'validation:phoneInvalid',
  email: 'validation:emailInvalid',
  btwNummer: 'validation:btwInvalid',
};

type TranslateFn = (key: string) => string;

function localizeFieldErrors(
  rawErrors: Record<string, string>,
  t: TranslateFn,
): Record<string, string> {
  const localized: Record<string, string> = {};

  for (const [field, message] of Object.entries(rawErrors)) {
    const fieldName = field as CreateCustomerFieldName;
    const i18nKey = FIELD_I18N_KEYS[fieldName];
    localized[field] = i18nKey ? t(i18nKey) : message;
  }

  return localized;
}

export function validateCreateCustomerForm(
  formData: CreateCustomerFormData,
  t: TranslateFn,
): { valid: true; payload: CreateCustomerPayload } | { valid: false; errors: Record<string, string> } {
  const payload = buildCreateCustomerPayload(formData);
  const result = createCustomerSchema.safeParse(payload);

  if (result.success) {
    return { valid: true, payload: result.data };
  }

  return {
    valid: false,
    errors: localizeFieldErrors(mapCreateCustomerZodErrors(result.error), t),
  };
}

export function validateEditCustomerForm(
  formData: CreateCustomerFormData,
  t: TranslateFn,
): { valid: true; payload: UpdateCustomerPayload } | { valid: false; errors: Record<string, string> } {
  const validation = validateCreateCustomerForm(formData, t);
  if (!validation.valid) {
    return validation;
  }

  return {
    valid: true,
    payload: buildUpdateCustomerPayload(formData),
  };
}

export function mapBackendCustomerValidationErrors(
  errors: Record<string, string>,
  t: TranslateFn,
): Record<string, string> {
  return localizeFieldErrors(errors, t);
}

export function focusFirstInvalidCustomerField(
  errors: Record<string, string>,
  fieldRefs: Partial<Record<CreateCustomerFieldName, HTMLElement | null>>,
) {
  for (const field of CREATE_CUSTOMER_FIELD_ORDER) {
    if (!errors[field]) {
      continue;
    }

    const element = fieldRefs[field];
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    break;
  }
}

export { CREATE_CUSTOMER_FIELD_ORDER, buildCreateCustomerPayload, buildUpdateCustomerPayload };
