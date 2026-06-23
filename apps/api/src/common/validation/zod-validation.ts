import { BadRequestException } from '@nestjs/common';
import type { ValidationIssue } from '@snelstart-order-app/shared';

type SafeParseSuccess<T> = { success: true; data: T };
type SafeParseFailure = { success: false; error: { issues: ValidationIssue[] } };
type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

type SafeParseSchema<T> = {
  safeParse(value: unknown): SafeParseResult<T>;
};

export function defaultZodErrorToFieldMap(error: { issues: ValidationIssue[] }): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path.map(String).join('.');
    if (!field || errors[field]) {
      continue;
    }
    errors[field] = issue.message;
  }

  return errors;
}

export function formatZodValidationResponse(
  error: { issues: ValidationIssue[] },
  mapErrors: (zodError: { issues: ValidationIssue[] }) => Record<string, string> = defaultZodErrorToFieldMap,
) {
  return {
    success: false as const,
    message: 'Validation failed.',
    errors: mapErrors(error),
  };
}

export function parseOrBadRequest<T>(
  schema: SafeParseSchema<T>,
  value: unknown,
  mapErrors?: (zodError: { issues: ValidationIssue[] }) => Record<string, string>,
): T {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  const failure = result as SafeParseFailure;
  throw new BadRequestException(formatZodValidationResponse(failure.error, mapErrors));
}
