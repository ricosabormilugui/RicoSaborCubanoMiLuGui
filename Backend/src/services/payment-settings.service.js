import {
  findPaymentSettingsDocument,
  savePaymentSettingsDocument
} from "../repositories/payment-settings.repository.js";
import { logger } from "../lib/logger.js";

const DEFAULT_CASH_PICKUP = "Pago en efectivo al recoger el pedido.";
const DEFAULT_CASH_DELIVERY = "Pago en efectivo en la entrega.";
const DEFAULT_TTL_MS = 15_000;

function isEnvPlaceholder(value) {
  return /^PENDIENTE_/i.test(value) && /CONFIGURAR/i.test(value);
}

function envValue(name, env = process.env) {
  const value = String(env?.[name] ?? "").trim();
  if (!value || isEnvPlaceholder(value)) return "";
  return value;
}

export function emptyPaymentSettings() {
  return {
    bizum: { enabled: false, phone: "", instructions: "" },
    bankTransfer: { enabled: false, holder: "", iban: "", instructions: "" },
    cash: {
      enabled: false,
      instructionsPickup: DEFAULT_CASH_PICKUP,
      instructionsDelivery: DEFAULT_CASH_DELIVERY
    }
  };
}

export function normalizeIban(value) {
  return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

export function formatIbanDisplay(value) {
  const compact = normalizeIban(value);
  return compact.replace(/(.{4})/g, "$1 ").trim();
}

export function isValidIban(value) {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.length < 15 || iban.length > 34) return false;
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export function normalizeBizumPhone(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

function trimText(value) {
  return String(value ?? "").trim();
}

function asBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
}

export function normalizePaymentSettings(document = {}) {
  const empty = emptyPaymentSettings();
  const source = document && typeof document === "object" ? document : {};
  const cash = source.cash && typeof source.cash === "object" ? source.cash : {};
  const pickup = trimText(cash.instructionsPickup) || DEFAULT_CASH_PICKUP;
  const delivery = trimText(cash.instructionsDelivery) || DEFAULT_CASH_DELIVERY;

  return {
    bizum: {
      enabled: asBoolean(source.bizum?.enabled, false),
      phone: normalizeBizumPhone(source.bizum?.phone),
      instructions: trimText(source.bizum?.instructions)
    },
    bankTransfer: {
      enabled: asBoolean(source.bankTransfer?.enabled, false),
      holder: trimText(source.bankTransfer?.holder),
      iban: normalizeIban(source.bankTransfer?.iban),
      instructions: trimText(source.bankTransfer?.instructions)
    },
    cash: {
      enabled: asBoolean(cash.enabled, false),
      instructionsPickup: pickup,
      instructionsDelivery: delivery
    }
  };
}

export function buildPaymentSettingsFromEnv(env = process.env) {
  const phone = normalizeBizumPhone(envValue("PAYMENT_BIZUM_PHONE", env));
  const holder = trimText(envValue("PAYMENT_BANK_HOLDER", env));
  const iban = normalizeIban(envValue("PAYMENT_BANK_IBAN", env));
  const cashInstructions = trimText(envValue("PAYMENT_CASH_INSTRUCTIONS", env));

  return normalizePaymentSettings({
    bizum: { enabled: Boolean(phone), phone, instructions: "" },
    bankTransfer: { enabled: Boolean(holder && iban), holder, iban, instructions: "" },
    cash: {
      enabled: Boolean(cashInstructions),
      instructionsPickup: DEFAULT_CASH_PICKUP,
      instructionsDelivery: DEFAULT_CASH_DELIVERY
    }
  });
}

function hasBootstrapData(settings) {
  return Boolean(
    settings.bizum.phone
    || (settings.bankTransfer.holder && settings.bankTransfer.iban)
    || settings.cash.enabled
  );
}

export function getPaymentMethodStatus(settings, method) {
  if (method === "bizum") {
    if (!settings.bizum.enabled) return "disabled";
    return settings.bizum.phone ? "configured" : "incomplete";
  }
  if (method === "bankTransfer") {
    if (!settings.bankTransfer.enabled) return "disabled";
    return settings.bankTransfer.holder && settings.bankTransfer.iban ? "configured" : "incomplete";
  }
  return settings.cash.enabled ? "active" : "disabled";
}

export function withAdminStatus(settings) {
  return {
    bizum: { ...settings.bizum, status: getPaymentMethodStatus(settings, "bizum") },
    bankTransfer: { ...settings.bankTransfer, status: getPaymentMethodStatus(settings, "bankTransfer") },
    cash: { ...settings.cash, status: getPaymentMethodStatus(settings, "cash") }
  };
}

export function toPublicPaymentSettings(settings) {
  const normalized = normalizePaymentSettings(settings);
  return {
    bizum: { enabled: Boolean(normalized.bizum.enabled && normalized.bizum.phone) },
    bankTransfer: { enabled: Boolean(normalized.bankTransfer.enabled && normalized.bankTransfer.holder && normalized.bankTransfer.iban) },
    cash: { enabled: Boolean(normalized.cash.enabled) }
  };
}

export function getEnabledPaymentMethods(settings) {
  const publicSettings = toPublicPaymentSettings(settings);
  return ["bizum", "bank_transfer", "cash"].filter((method) => {
    if (method === "bizum") return publicSettings.bizum.enabled;
    if (method === "bank_transfer") return publicSettings.bankTransfer.enabled;
    return publicSettings.cash.enabled;
  });
}

export function validatePaymentSettingsPayload(body = {}) {
  const normalized = normalizePaymentSettings(body);
  const errors = [];

  if (normalized.bizum.enabled && !normalized.bizum.phone) {
    errors.push({ field: "bizum.phone", message: "El teléfono de Bizum es obligatorio si el método está activo." });
  }

  if (normalized.bankTransfer.enabled) {
    if (!normalized.bankTransfer.holder) {
      errors.push({ field: "bankTransfer.holder", message: "El titular es obligatorio si la transferencia está activa." });
    }
    if (!normalized.bankTransfer.iban) {
      errors.push({ field: "bankTransfer.iban", message: "El IBAN es obligatorio si la transferencia está activa." });
    } else if (!isValidIban(normalized.bankTransfer.iban)) {
      errors.push({ field: "bankTransfer.iban", message: "El IBAN no tiene un formato válido." });
    }
  }

  if (normalized.bizum.phone && normalizeBizumPhone(normalized.bizum.phone).replace(/\D/g, "").length < 8) {
    errors.push({ field: "bizum.phone", message: "El teléfono de Bizum no es válido." });
  }

  return { settings: normalized, errors };
}

export function createPaymentSettingsService({
  readDocument = findPaymentSettingsDocument,
  writeDocument = savePaymentSettingsDocument,
  env = process.env,
  ttlMs = DEFAULT_TTL_MS,
  log = logger
} = {}) {
  let cache = { value: null, expiresAt: 0 };

  function invalidate() {
    cache = { value: null, expiresAt: 0 };
  }

  async function getCanonical({ allowCache = true } = {}) {
    if (allowCache && cache.value && Date.now() < cache.expiresAt) {
      return cache.value;
    }

    const stored = await readDocument();
    if (stored) {
      const settings = normalizePaymentSettings(stored);
      cache = { value: settings, expiresAt: Date.now() + ttlMs };
      return settings;
    }

    const fromEnv = buildPaymentSettingsFromEnv(env);
    if (hasBootstrapData(fromEnv)) {
      try {
        await writeDocument(fromEnv, { updatedBy: "env-bootstrap" });
        log.info?.("payment.settings.bootstrapped_from_env", { methods: getEnabledPaymentMethods(fromEnv) });
      } catch (error) {
        log.error?.("payment.settings.bootstrap_failed", { error: error.message ?? "Unexpected error" });
      }
    }

    cache = { value: fromEnv, expiresAt: Date.now() + ttlMs };
    return fromEnv;
  }

  async function save(payload, { updatedBy } = {}) {
    const { settings, errors } = validatePaymentSettingsPayload(payload);
    if (errors.length) {
      const error = new Error(errors[0].message);
      error.status = 400;
      error.fields = errors;
      throw error;
    }

    await writeDocument(settings, { updatedBy });
    invalidate();
    cache = { value: settings, expiresAt: Date.now() + ttlMs };
    return settings;
  }

  return {
    invalidate,
    getCanonical,
    save,
    toPublic: async () => toPublicPaymentSettings(await getCanonical()),
    toAdmin: async () => withAdminStatus(await getCanonical())
  };
}

export const paymentSettingsService = createPaymentSettingsService();

export function getCanonicalPaymentSettings(options) {
  return paymentSettingsService.getCanonical(options);
}

export function invalidatePaymentSettingsCache() {
  paymentSettingsService.invalidate();
}
