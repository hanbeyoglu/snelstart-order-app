import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import {
  buildCreateCustomerPayload,
  buildUpdateCustomerPayload,
  createCustomerSchema,
  mapCreateCustomerZodErrors,
  updateCustomerSchema,
} from '@snelstart-order-app/shared';
import {
  formatZodValidationResponse,
  parseOrBadRequest,
} from '../common/validation/zod-validation';

test('createCustomerSchema rejects missing required fields with field-level errors', () => {
  const result = createCustomerSchema.safeParse({});

  assert.equal(result.success, false);
  if (result.success) {
    return;
  }

  const errors = mapCreateCustomerZodErrors(result.error);
  assert.equal(errors.relatiesoort, 'Please select at least one relation type.');
  assert.equal(errors.naam, 'This field is required.');
  assert.equal(errors.straat, 'This field is required.');
});

test('parseOrBadRequest returns structured validation response for customer payload', () => {
  assert.throws(
    () => parseOrBadRequest(createCustomerSchema, {}, mapCreateCustomerZodErrors),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const body = error.getResponse() as {
        success: boolean;
        message: string;
        errors: Record<string, string>;
      };
      assert.equal(body.success, false);
      assert.equal(body.message, 'Validation failed.');
      assert.equal(body.errors.naam, 'This field is required.');
      return true;
    },
  );
});

test('buildCreateCustomerPayload keeps optional fields out when empty', () => {
  const payload = buildCreateCustomerPayload({
    relatiesoort: ['Klant'],
    naam: 'Test BV',
    straat: 'Main Street 1',
    postcode: '1234AB',
    plaats: 'Rotterdam',
    landId: '1d057861-41da-4743-a34b-33388e80c02d',
    telefoon: '',
    email: '',
    kvkNummer: '',
    btwNummer: '',
  });

  const result = createCustomerSchema.safeParse(payload);
  assert.equal(result.success, true);
  if (!result.success) {
    return;
  }

  assert.equal(result.data.btwNummer, undefined);
  assert.equal(result.data.email, undefined);
});

test('formatZodValidationResponse uses custom field mapper', () => {
  const result = createCustomerSchema.safeParse({
    relatiesoort: ['Klant'],
    naam: 'Test BV',
    vestigingsAdres: {
      straat: '',
      postcode: '1234AB',
      plaats: 'Rotterdam',
      land: { id: 'land-id' },
    },
  });

  assert.equal(result.success, false);
  if (result.success) {
    return;
  }

  const response = formatZodValidationResponse(result.error, mapCreateCustomerZodErrors);
  assert.equal(response.errors.straat, 'This field is required.');
  assert.equal(response.errors['vestigingsAdres.straat'], undefined);
});

test('updateCustomerSchema rejects invalid email with field-level errors', () => {
  const payload = buildCreateCustomerPayload({
    relatiesoort: ['Klant'],
    naam: 'Test BV',
    straat: 'Main Street 1',
    postcode: '1234AB',
    plaats: 'Rotterdam',
    landId: '1d057861-41da-4743-a34b-33388e80c02d',
    email: 'not-an-email',
  });

  const { relatiesoort: _relatiesoort, ...updatePayload } = payload;
  const result = updateCustomerSchema.safeParse(updatePayload);

  assert.equal(result.success, false);
  if (result.success) {
    return;
  }

  const errors = mapCreateCustomerZodErrors(result.error);
  assert.equal(errors.email, 'Please enter a valid email address.');
});

test('parseOrBadRequest returns 400 validation response for update payload', () => {
  assert.throws(
    () =>
      parseOrBadRequest(
        updateCustomerSchema,
        {
          naam: '',
          vestigingsAdres: {
            straat: 'Main Street 1',
            postcode: '1234AB',
            plaats: 'Rotterdam',
            land: { id: 'land-id' },
          },
        },
        mapCreateCustomerZodErrors,
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.getStatus(), 400);
      const body = error.getResponse() as {
        success: boolean;
        message: string;
        errors: Record<string, string>;
      };
      assert.equal(body.success, false);
      assert.equal(body.message, 'Validation failed.');
      assert.equal(body.errors.naam, 'This field is required.');
      return true;
    },
  );
});

const validFormInput = {
  relatiesoort: ['Klant'],
  naam: 'Test BV',
  straat: 'Main Street 1',
  postcode: '1234AB',
  plaats: 'Rotterdam',
  landId: '1d057861-41da-4743-a34b-33388e80c02d',
  telefoon: '',
  email: '',
  kvkNummer: '',
  btwNummer: '',
};

test('regression: empty required fields produce field-level errors', () => {
  const payload = buildCreateCustomerPayload({
    ...validFormInput,
    relatiesoort: [],
    naam: '',
    straat: '',
    postcode: '',
    plaats: '',
  });

  const result = createCustomerSchema.safeParse(payload);
  assert.equal(result.success, false);
  if (result.success) {
    return;
  }

  const errors = mapCreateCustomerZodErrors(result.error);
  assert.equal(errors.relatiesoort, 'Please select at least one relation type.');
  assert.equal(errors.naam, 'This field is required.');
  assert.equal(errors.straat, 'This field is required.');
  assert.equal(errors.postcode, 'This field is required.');
  assert.equal(errors.plaats, 'This field is required.');
});

test('regression: empty btwNummer is allowed', () => {
  const payload = buildCreateCustomerPayload({
    ...validFormInput,
    btwNummer: '',
  });

  const result = createCustomerSchema.safeParse(payload);
  assert.equal(result.success, true);
  if (!result.success) {
    return;
  }

  assert.equal(result.data.btwNummer, undefined);
});

test('regression: invalid btwNummer format is rejected', () => {
  const payload = buildCreateCustomerPayload({
    ...validFormInput,
    btwNummer: 'INVALID-BTW',
  });

  const result = createCustomerSchema.safeParse(payload);
  assert.equal(result.success, false);
  if (result.success) {
    return;
  }

  const errors = mapCreateCustomerZodErrors(result.error);
  assert.equal(errors.btwNummer, 'Please enter a valid VAT number (e.g. NL123456789B01).');
});

test('regression: invalid email format is rejected', () => {
  const payload = buildCreateCustomerPayload({
    ...validFormInput,
    email: 'not-an-email',
  });

  const result = createCustomerSchema.safeParse(payload);
  assert.equal(result.success, false);
  if (result.success) {
    return;
  }

  const errors = mapCreateCustomerZodErrors(result.error);
  assert.equal(errors.email, 'Please enter a valid email address.');
});

test('regression: valid create payload passes schema', () => {
  const payload = buildCreateCustomerPayload({
    ...validFormInput,
    email: 'sales@example.nl',
    btwNummer: 'NL123456789B01',
  });

  const result = createCustomerSchema.safeParse(payload);
  assert.equal(result.success, true);
  if (!result.success) {
    return;
  }

  assert.equal(result.data.naam, 'Test BV');
  assert.equal(result.data.email, 'sales@example.nl');
  assert.equal(result.data.btwNummer, 'NL123456789B01');
});

test('regression: valid update payload passes update schema', () => {
  const createPayload = buildCreateCustomerPayload({
    ...validFormInput,
    email: 'sales@example.nl',
  });
  const { relatiesoort: _relatiesoort, ...updatePayload } = createPayload;

  const result = updateCustomerSchema.safeParse(updatePayload);
  assert.equal(result.success, true);
});

test('regression: bypassed invalid create payload throws BadRequestException with status 400', () => {
  assert.throws(
    () =>
      parseOrBadRequest(
        createCustomerSchema,
        buildCreateCustomerPayload({
          ...validFormInput,
          naam: '',
        }),
        mapCreateCustomerZodErrors,
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.getStatus(), 400);
      const body = error.getResponse() as { success: boolean; errors: Record<string, string> };
      assert.equal(body.success, false);
      assert.ok(body.errors.naam);
      return true;
    },
  );
});

test('regression: bypassed invalid update payload throws BadRequestException with status 400', () => {
  assert.throws(
    () =>
      parseOrBadRequest(
        updateCustomerSchema,
        {
          email: 'bad-email',
        },
        mapCreateCustomerZodErrors,
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.getStatus(), 400);
      const body = error.getResponse() as { success: boolean; errors: Record<string, string> };
      assert.equal(body.success, false);
      assert.ok(body.errors.email);
      return true;
    },
  );
});

test('regression: update payload builder omits relatiesoort for API', () => {
  const updatePayload = buildUpdateCustomerPayload(validFormInput);
  assert.equal('relatiesoort' in updatePayload, false);
  assert.equal(updateCustomerSchema.safeParse(updatePayload).success, true);
});
