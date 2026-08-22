function readPositiveInteger(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(process.env[name]);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export const PASSWORD_RESET_TTL_MINUTES = readPositiveInteger("PASSWORD_RESET_TTL_MINUTES", 60, { min: 5, max: 1440 });
export const PASSWORD_RESET_RATE_WINDOW_MINUTES = readPositiveInteger("PASSWORD_RESET_RATE_WINDOW_MINUTES", 15, { min: 1, max: 1440 });
export const PASSWORD_RESET_RATE_MAX_PER_EMAIL = readPositiveInteger("PASSWORD_RESET_RATE_MAX_PER_EMAIL", 3, { min: 1, max: 100 });
export const PASSWORD_RESET_RATE_MAX_PER_IP = readPositiveInteger("PASSWORD_RESET_RATE_MAX_PER_IP", 10, { min: 1, max: 1000 });

export const PASSWORD_RECOVERY_GENERIC_MESSAGE =
  "Si existe una cuenta asociada a ese correo, recibirás un mensaje con las instrucciones para restablecer tu contraseña.";

export const PASSWORD_RESET_INVALID_MESSAGE =
  "El enlace de recuperación no es válido o ha caducado.";

export function buildPasswordResetUrl(rawToken) {
  const configuredUrl = String(process.env.FRONTEND_URL ?? "").trim();
  if (!configuredUrl) {
    throw new Error("Missing environment variable: FRONTEND_URL");
  }

  const url = new URL("/reset-password", configuredUrl);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("FRONTEND_URL must use http or https");
  }

  // The fragment is never sent to the web server or included in HTTP access logs.
  url.hash = new URLSearchParams({ token: rawToken }).toString();
  return url.toString();
}
