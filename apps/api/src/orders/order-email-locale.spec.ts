import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveOrderEmailLocale,
  resolveOrderEmailLocaleFromOrder,
} from '@snelstart-order-app/shared';

test('resolveOrderEmailLocale prefers order locale over user and settings', () => {
  assert.equal(
    resolveOrderEmailLocale({
      orderLocale: 'nl',
      userPreferredLanguage: 'en',
      settingsLocale: 'de',
    }),
    'nl',
  );
});

test('resolveOrderEmailLocale uses Arabic when order locale is ar', () => {
  assert.equal(resolveOrderEmailLocaleFromOrder({ locale: 'ar' }), 'ar');
});

test('resolveOrderEmailLocale falls back user then customer then env', () => {
  assert.equal(
    resolveOrderEmailLocale({
      userPreferredLanguage: 'de',
      customerPreferredLanguage: 'fr',
    }),
    'de',
  );
  assert.equal(
    resolveOrderEmailLocale({
      customerPreferredLanguage: 'nl',
    }),
    'nl',
  );
  assert.equal(
    resolveOrderEmailLocale({
      envLocale: 'en',
    }),
    'en',
  );
});

test('resolveOrderEmailLocale defaults to tr when nothing is set', () => {
  assert.equal(resolveOrderEmailLocale({}), 'tr');
});
