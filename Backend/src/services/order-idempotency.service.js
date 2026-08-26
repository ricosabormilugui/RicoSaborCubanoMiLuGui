import { createHash } from "node:crypto";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export class InvalidIdempotencyKeyError extends Error {
  constructor(message = "Idempotency-Key debe tener entre 8 y 128 caracteres seguros.") {
    super(message);
    this.name = "InvalidIdempotencyKeyError";
    this.status = 400;
    this.code = "INVALID_IDEMPOTENCY_KEY";
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("La clave de idempotencia ya fue utilizada para una solicitud diferente.");
    this.name = "IdempotencyConflictError";
    this.status = 409;
    this.code = "IDEMPOTENCY_CONFLICT";
  }
}

export function validateIdempotencyKey(value) {
  const key = String(value ?? "").trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) throw new InvalidIdempotencyKeyError();
  return key;
}

function normalizeText(value, { lower = false, upper = false } = {}) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  if (lower) return normalized.toLocaleLowerCase("es-ES");
  if (upper) return normalized.toLocaleUpperCase("es-ES");
  return normalized;
}

function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeCustomization(selections) {
  if (!Array.isArray(selections)) return [];
  return selections
    .map((selection) => ({
      groupKey: normalizeText(selection?.groupKey ?? selection?.label, { lower: true }),
      optionId: normalizeText(selection?.optionId ?? selection?.value, { lower: true }),
      value: normalizeText(selection?.value, { lower: true })
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      baseProductId: normalizeText(item?.baseProductId ?? item?.productId).split("::")[0],
      quantity: Number(item?.quantity),
      customization: normalizeCustomization(item?.customization)
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

export function buildOrderRequestFingerprint(payload, auth) {
  const delivery = payload?.delivery ?? {};
  const identity = ["customer", "admin"].includes(auth?.role) && typeof auth?.sub === "string" && auth.sub
    ? { accountMode: "registered", userId: normalizeText(auth?.sub), email: normalizeText(auth?.email, { lower: true }) }
    : { accountMode: "guest", customerId: normalizeText(payload?.customerId) };
  const intention = {
    identity,
    customer: {
      fullName: normalizeText(payload?.customer?.fullName, { lower: true }),
      phone: normalizePhone(payload?.customer?.phone),
      email: normalizeText(payload?.customer?.email ?? auth?.email, { lower: true })
    },
    items: normalizeItems(payload?.items),
    delivery: {
      type: normalizeText(payload?.deliveryType ?? delivery?.type, { lower: true }),
      date: normalizeText(payload?.deliveryDate ?? delivery?.date),
      slot: normalizeText(payload?.deliverySlot ?? delivery?.slot),
      address: normalizeText(delivery?.address, { lower: true }),
      postalCode: normalizeText(delivery?.postalCode ?? payload?.postalCode),
      reference: normalizeText(delivery?.reference, { lower: true })
    },
    notes: normalizeText(payload?.notes),
    couponCode: normalizeText(payload?.couponCode ?? payload?.coupon?.code, { upper: true }).replace(/\s+/g, ""),
    paymentMethod: normalizeText(payload?.payment?.method ?? payload?.paymentMethod, { lower: true }),
    marketingConsent: Boolean(payload?.marketingConsent ?? payload?.customer?.marketingConsent),
    legalConsent: Boolean(payload?.legalConsent)
  };
  const canonical = JSON.stringify(stableValue(intention));
  return createHash("sha256").update(canonical).digest("hex");
}

export function safeIdempotencyReference(key) {
  return createHash("sha256").update(String(key)).digest("hex").slice(0, 12);
}

function replayFor(existing, requestFingerprint) {
  if (existing.requestFingerprint !== requestFingerprint) throw new IdempotencyConflictError();
  return { order: existing, replay: true };
}

export async function executeIdempotentOrderCreation({
  idempotencyKey,
  requestFingerprint,
  findExisting,
  runInTransaction,
  createWithinTransaction
}) {
  const existing = await findExisting(idempotencyKey);
  if (existing) return replayFor(existing, requestFingerprint);

  try {
    return await runInTransaction(async (session) => {
      const existingInTransaction = await findExisting(idempotencyKey, { session });
      if (existingInTransaction) return replayFor(existingInTransaction, requestFingerprint);
      const order = await createWithinTransaction(session);
      return { order, replay: false };
    });
  } catch (error) {
    const committedByConcurrentRequest = await findExisting(idempotencyKey);
    if (committedByConcurrentRequest) return replayFor(committedByConcurrentRequest, requestFingerprint);
    throw error;
  }
}
