import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const rootUrl = new URL('../', import.meta.url);
const source = readFileSync(new URL('src/app/core/utils/order-idempotency.ts', rootUrl), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
const { OrderIdempotencyIntent, buildClientOrderIntentFingerprint } = await import(moduleUrl);

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function deterministicCrypto() {
  let counter = 0;
  return {
    randomUUID() {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
    }
  };
}

function payload(overrides = {}) {
  return {
    customer: { fullName: 'Cliente prueba', phone: '34600000000', email: 'qa@example.test' },
    items: [{ productId: '64b000000000000000000001', baseProductId: '64b000000000000000000001', quantity: 1, unitPrice: 20 }],
    delivery: { type: 'pickup', date: '2026-09-01', slot: '10:00-12:00' },
    deliveryType: 'pickup',
    payment: { method: 'cash' },
    legalConsent: true,
    ...overrides
  };
}

test('frontend caso 16: retry tras timeout y recarga reutiliza clave', () => {
  const storage = new MemoryStorage();
  const crypto = deterministicCrypto();
  const firstInstance = new OrderIdempotencyIntent(storage, crypto);
  const key = firstInstance.keyFor(payload());
  const afterTimeout = new OrderIdempotencyIntent(storage, crypto);
  assert.equal(afterTimeout.keyFor(payload()), key);
});

test('frontend caso 17: éxito limpia la clave', () => {
  const storage = new MemoryStorage();
  const crypto = deterministicCrypto();
  const intent = new OrderIdempotencyIntent(storage, crypto);
  const first = intent.keyFor(payload());
  intent.complete();
  const next = intent.keyFor(payload());
  assert.notEqual(next, first);
});

test('frontend caso 18: un pedido materialmente distinto usa nueva clave', () => {
  const intent = new OrderIdempotencyIntent(new MemoryStorage(), deterministicCrypto());
  const first = intent.keyFor(payload());
  const changed = intent.keyFor(payload({
    items: [{ productId: '64b000000000000000000001', baseProductId: '64b000000000000000000001', quantity: 2, unitPrice: 20 }]
  }));
  assert.notEqual(changed, first);
});

test('el fingerprint cliente ignora precio pero detecta cantidad y entrega', () => {
  const original = payload();
  const changedPrice = payload({ items: [{ ...original.items[0], unitPrice: 1 }] });
  const changedDate = payload({ delivery: { ...original.delivery, date: '2026-09-02' } });
  assert.equal(buildClientOrderIntentFingerprint(original), buildClientOrderIntentFingerprint(changedPrice));
  assert.notEqual(buildClientOrderIntentFingerprint(original), buildClientOrderIntentFingerprint(changedDate));
});

test('frontend caso 19: timeout o error no limpia carrito ni intención', () => {
  const checkout = readFileSync(new URL('src/app/features/checkout/checkout-page.component.ts', rootUrl), 'utf8');
  const submit = checkout.indexOf('await this.orderService.submitOrder(payload)');
  const clearCart = checkout.indexOf('this.cart.clear()', submit);
  const completeIntent = checkout.indexOf('this.orderService.completeOrderIntent()', submit);
  const catchBlock = checkout.indexOf('} catch (error)', submit);
  assert.ok(submit >= 0 && clearCart > submit && completeIntent > clearCart && catchBlock > completeIntent);
  assert.doesNotMatch(checkout.slice(catchBlock), /cart\.clear\(\)|completeOrderIntent\(\)/);
});

test('frontend caso 20: replay exitoso sigue la misma limpieza de un éxito normal', () => {
  const service = readFileSync(new URL('src/app/core/services/order.service.ts', rootUrl), 'utf8');
  assert.match(service, /'Idempotency-Key': idempotencyKey/);
  assert.match(service, /const idempotencyKey = this\.orderIntent\.keyFor\(payload\)/);
  assert.match(service, /completeOrderIntent\(\): void/);
});
