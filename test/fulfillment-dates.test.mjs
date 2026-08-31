import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const rootUrl = new URL('../', import.meta.url);

function loadShipping() {
  const json = readFileSync(new URL('Backend/src/config/order-rules.json', rootUrl), 'utf8');
  const source = readFileSync(new URL('src/app/core/config/shipping.config.ts', rootUrl), 'utf8')
    .replace(/import type \{ DeliveryType \} from '[^']+';\s*/, '')
    .replace(/import orderRules from '[^']+';/, `const orderRules = ${json};`);
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
  return import(moduleUrl);
}

const shipping = await loadShipping();
const {
  DELIVERY_RULES,
  getMinimumFulfillmentDate,
  getValidSlotsForDate,
  instantInBusinessTimezone,
  isClosedFulfillmentDate,
  isFulfillmentDateAvailable,
  reconcileFulfillmentSelection,
  validateFulfillmentSelection
} = shipping;

function at(date, hour, minute = 0) {
  const instant = instantInBusinessTimezone(date, hour, minute);
  if (!instant) throw new Error(`Fecha inválida ${date}`);
  return instant;
}

test('la fuente de verdad de antelación es order-rules.json', () => {
  assert.equal(DELIVERY_RULES.timeZone, 'Europe/Madrid');
  assert.equal(DELIVERY_RULES.advanceNoticeHours, 24);
  assert.deepEqual(DELIVERY_RULES.closedWeekdays, [0]);
  assert.doesNotMatch(readFileSync(new URL('src/app/core/config/shipping.config.ts', rootUrl), 'utf8'), /businessDays|workingDays|skipWeekend/);
});

test('caso A: 24 horas exactas son válidas', () => {
  const result = validateFulfillmentSelection('2026-08-28', '18:00-21:00', 'delivery', 24, at('2026-08-27', 18, 0));
  assert.equal(result.valid, true);
});

test('caso B: un minuto menos de 24h es inválido', () => {
  const result = validateFulfillmentSelection('2026-08-28', '18:00-21:00', 'delivery', 24, at('2026-08-27', 18, 1));
  assert.equal(result.valid, false);
  if (!result.valid) assert.match(result.message, /Necesitamos al menos 24 horas para preparar tu pedido/);
});

test('caso C: viernes no salta el sábado abierto', () => {
  const now = at('2026-08-28', 10, 0);
  assert.equal(getMinimumFulfillmentDate('delivery', 24, now), '2026-08-29');
  assert.equal(isFulfillmentDateAvailable('2026-08-29', 'delivery', 24, now), true);
});

test('caso D: sábado no salta el domingo si está abierto en configuración', () => {
  const now = at('2026-08-29', 10, 0);
  const open = { closedWeekdays: [] };
  assert.equal(isClosedFulfillmentDate('2026-08-30', open), false);
  assert.equal(isFulfillmentDateAvailable('2026-08-30', 'delivery', 24, now, open), true);
});

test('caso E: domingo cerrado por closedWeekdays', () => {
  assert.equal(isClosedFulfillmentDate('2026-08-30'), true);
  assert.equal(isFulfillmentDateAvailable('2026-08-30', 'delivery', 24, at('2026-08-28', 10, 0)), false);
});

test('caso F: sábado sin franja posterior a +24h no está disponible', () => {
  const now = at('2026-08-28', 19, 0);
  assert.equal(isFulfillmentDateAvailable('2026-08-29', 'delivery', 24, now), false);
  assert.deepEqual(getValidSlotsForDate('2026-08-29', 'delivery', 24, now), []);
});

test('caso G: sábado con franja posterior a +24h muestra solo esa franja', () => {
  const now = at('2026-08-28', 10, 0);
  assert.deepEqual(getValidSlotsForDate('2026-08-29', 'delivery', 24, now), ['18:00-21:00']);
});

test('caso J: cambiar de fecha limpia la franja incompatible', () => {
  const next = reconcileFulfillmentSelection('2026-08-29', '18:00-21:00', 'pickup', 24, at('2026-08-27', 10, 0));
  assert.equal(next.date, '2026-08-29');
  assert.equal(next.slot, '');
});

test('caso K: delivery ↔ pickup recalcula fecha y franjas', () => {
  const now = at('2026-08-28', 10, 0);
  const delivery = reconcileFulfillmentSelection('2026-08-29', '18:00-21:00', 'delivery', 24, now);
  assert.equal(delivery.slot, '18:00-21:00');
  const pickup = reconcileFulfillmentSelection('2026-08-29', '18:00-21:00', 'pickup', 24, now);
  assert.equal(pickup.date, '2026-08-29');
  assert.equal(pickup.slot, '');
});

test('el checkout valida el change del datepicker nativo', () => {
  const checkout = readFileSync(new URL('src/app/features/checkout/checkout-page.component.ts', rootUrl), 'utf8');
  assert.match(checkout, /onDeliveryDateChange\(\)/);
  assert.match(checkout, /\[min\]="minimumDeliveryDate\(\)"/);
  assert.match(checkout, /\[max\]="maximumDeliveryDate\(\)"/);
  assert.match(checkout, /getValidSlotsForDate/);
  assert.match(checkout, /reconcileFulfillmentSelection/);
});
