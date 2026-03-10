import crypto from "crypto";
import { getRequiredEnv } from "./env.js";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const iterations = 120000;
  const digest = "sha512";
  const keylen = 64;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString("hex");
  return `${iterations}:${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [iterationsRaw, salt, expected] = String(storedHash).split(":");
  const iterations = Number(iterationsRaw);
  if (!iterations || !salt || !expected) return false;

  const actual = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function signToken(payload, expiresInSeconds = 60 * 60 * 8) {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = { ...payload, exp };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedBody = base64url(JSON.stringify(body));
  const secret = getRequiredEnv("AUTH_TOKEN_SECRET");
  const signature = crypto.createHmac("sha256", secret).update(`${encodedHeader}.${encodedBody}`).digest("base64url");

  return `${encodedHeader}.${encodedBody}.${signature}`;
}

export function verifyToken(token) {
  const [encodedHeader, encodedBody, signature] = String(token).split(".");
  if (!encodedHeader || !encodedBody || !signature) return null;

  const secret = getRequiredEnv("AUTH_TOKEN_SECRET");
  const expectedSignature = crypto.createHmac("sha256", secret).update(`${encodedHeader}.${encodedBody}`).digest("base64url");
  if (signature !== expectedSignature) return null;

  const payload = JSON.parse(Buffer.from(encodedBody, "base64url").toString("utf8"));
  if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
