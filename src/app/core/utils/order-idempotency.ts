const ORDER_INTENT_STORAGE_KEY = 'mixsabor-order-intent-v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
}

interface StoredOrderIntent {
  key: string;
  fingerprint: string;
}

function normalizeText(value: unknown, lower = false): string {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  return lower ? normalized.toLocaleLowerCase('es-ES') : normalized;
}

function normalizeCustomization(value: unknown): Array<Record<string, string>> {
  if (!Array.isArray(value)) return [];
  return value
    .map((selection) => {
      const item = selection as Record<string, unknown>;
      return {
        groupKey: normalizeText(item['groupKey'] ?? item['label'], true),
        optionId: normalizeText(item['optionId'] ?? item['value'], true),
        value: normalizeText(item['value'], true)
      };
    })
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(object).sort().map((key) => [key, stableValue(object[key])]));
  }
  return value;
}

function relevantOrderIntent(payload: Record<string, unknown>): Record<string, unknown> {
  const customer = (payload['customer'] ?? {}) as Record<string, unknown>;
  const delivery = (payload['delivery'] ?? {}) as Record<string, unknown>;
  const payment = (payload['payment'] ?? {}) as Record<string, unknown>;
  const items = Array.isArray(payload['items']) ? payload['items'] as Array<Record<string, unknown>> : [];
  return {
    customer: {
      fullName: normalizeText(customer['fullName'], true),
      phone: normalizeText(customer['phone']).replace(/\D/g, ''),
      email: normalizeText(customer['email'], true)
    },
    items: items.map((item) => ({
      baseProductId: normalizeText(item['baseProductId'] ?? item['productId']).split('::')[0],
      quantity: Number(item['quantity']),
      customization: normalizeCustomization(item['customization'])
    })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    delivery: {
      type: normalizeText(payload['deliveryType'] ?? delivery['type'], true),
      date: normalizeText(payload['deliveryDate'] ?? delivery['date']),
      slot: normalizeText(payload['deliverySlot'] ?? delivery['slot']),
      address: normalizeText(delivery['address'], true),
      postalCode: normalizeText(delivery['postalCode'] ?? payload['postalCode']),
      reference: normalizeText(delivery['reference'], true)
    },
    notes: normalizeText(payload['notes']),
    couponCode: normalizeText(payload['couponCode']).toLocaleUpperCase('es-ES').replace(/\s+/g, ''),
    paymentMethod: normalizeText(payment['method'] ?? payload['paymentMethod'], true),
    marketingConsent: Boolean(payload['marketingConsent']),
    legalConsent: Boolean(payload['legalConsent'])
  };
}

export function buildClientOrderIntentFingerprint(payload: unknown): string {
  const canonical = JSON.stringify(stableValue(relevantOrderIntent((payload ?? {}) as Record<string, unknown>)));
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= BigInt(canonical.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `v1-${canonical.length}-${hash.toString(16).padStart(16, '0')}`;
}

function resolveSessionStorage(): StorageLike | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

function createIdempotencyKey(cryptoSource: CryptoLike | undefined): string {
  try {
    if (cryptoSource?.randomUUID) return `order_${cryptoSource.randomUUID()}`;
    if (cryptoSource?.getRandomValues) {
      const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
      return `order_${Array.from(bytes).map((value) => value.toString(16).padStart(2, '0')).join('')}`;
    }
  } catch {}
  return `order_${Date.now().toString(36)}_${Math.random().toString(36).slice(2).padEnd(12, '0')}`;
}

export class OrderIdempotencyIntent {
  private memoryIntent: StoredOrderIntent | undefined;

  constructor(
    private readonly storage: StorageLike | undefined = resolveSessionStorage(),
    private readonly cryptoSource: CryptoLike | undefined = globalThis.crypto
  ) {}

  keyFor(payload: unknown): string {
    const fingerprint = buildClientOrderIntentFingerprint(payload);
    const existing = this.read();
    if (existing?.fingerprint === fingerprint) return existing.key;

    const intent = { key: createIdempotencyKey(this.cryptoSource), fingerprint };
    this.memoryIntent = intent;
    try {
      this.storage?.setItem(ORDER_INTENT_STORAGE_KEY, JSON.stringify(intent));
    } catch {}
    return intent.key;
  }

  complete(): void {
    this.memoryIntent = undefined;
    try {
      this.storage?.removeItem(ORDER_INTENT_STORAGE_KEY);
    } catch {}
  }

  private read(): StoredOrderIntent | undefined {
    if (this.memoryIntent) return this.memoryIntent;
    try {
      const raw = this.storage?.getItem(ORDER_INTENT_STORAGE_KEY);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as Partial<StoredOrderIntent>;
      if (!/^order_[A-Za-z0-9._:-]{8,122}$/.test(String(parsed.key ?? '')) || !parsed.fingerprint) {
        this.storage?.removeItem(ORDER_INTENT_STORAGE_KEY);
        return undefined;
      }
      this.memoryIntent = { key: String(parsed.key), fingerprint: String(parsed.fingerprint) };
      return this.memoryIntent;
    } catch {
      return undefined;
    }
  }
}
