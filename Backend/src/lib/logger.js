const SENSITIVE_KEY = /password|authorization|cookie|secret|api[_-]?key|token|mongo(?:db)?[_-]?(?:uri|url)|iban/i;

function maskEmail(value) {
  const [local = "", domain = ""] = String(value).split("@");
  if (!domain) return "[redacted]";
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(value) {
  const digits = String(value).replace(/\D/g, "");
  return digits ? `***${digits.slice(-4)}` : "[redacted]";
}

function sanitizeString(value) {
  return String(value)
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@\s]+@/gi, "$1[redacted]@")
    .replace(/([?&][^=\s]*(?:token|key|secret)[^=\s]*=)[^&\s]+/gi, "$1[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (email) => maskEmail(email))
    .replace(/(?<![\w-])(?:\+\d{1,3}[\s.-]?)?\d(?:[\s.-]?\d){8,12}(?![\w-])/g, (phone) => maskPhone(phone));
}

function sanitize(value, key = "") {
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (/email/i.test(key)) return maskEmail(value);
  if (/phone|telefono|teléfono/i.test(key)) return maskPhone(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined
    };
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
  }
  return sanitizeString(value);
}

function log(level, event, data = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitize(data)
  };

  const writer = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  writer(JSON.stringify(payload));
}

export const logger = {
  info(event, data) {
    log('info', event, data);
  },
  warn(event, data) {
    log('warn', event, data);
  },
  error(event, data) {
    log('error', event, data);
  },
  exception(event, error, data = {}) {
    log('error', event, { ...data, error });
  }
};
