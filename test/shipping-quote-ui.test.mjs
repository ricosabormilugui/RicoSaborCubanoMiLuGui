import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);

test('checkout distingue quote inválida de entrega gratuita', () => {
  const component = readFileSync(new URL('src/app/features/checkout/checkout-page.component.ts', rootUrl), 'utf8');
  const template = readFileSync(new URL('src/app/features/checkout/checkout-page.component.html', rootUrl), 'utf8');

  assert.match(component, /!this\.shippingQuote\(\)\.available/);
  assert.match(component, /orderTotal\(\): number \| null/);
  assert.match(template, /shippingQuote\(\)\.deliveryFee === 0 \? 'GRATIS'/);
  assert.match(template, /<strong>—<\/strong>/);
  assert.match(template, /Pendiente de calcular/);
  assert.match(template, /@if \(shippingQuote\(\)\.available\)/);
  assert.match(template, /amountMissingForFreeShipping/);
  assert.match(template, /Te faltan .* para conseguir envío gratis/);
  assert.match(template, /Has conseguido envío GRATIS para esta entrega/);
  assert.match(template, /distanceKm \| number:'1\.1-1'/);
});
