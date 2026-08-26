import crypto from "node:crypto";
import {
  PASSWORD_RESET_TTL_MINUTES,
  buildPasswordResetUrl,
  sanitizePasswordResetReturnUrl
} from "../config/password-recovery.config.js";
import { hashPassword } from "../lib/auth.js";
import { validatePassword } from "../lib/password-policy.js";
import * as usersRepository from "../repositories/users.repository.js";
import { sendPasswordResetEmail } from "./email.service.js";
import { notifyPasswordChanged } from "./user-notification.service.js";
import { logger } from "../lib/logger.js";

export function generatePasswordResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken), "utf8").digest("hex");
}

export function createPasswordRecoveryService({
  repository = usersRepository,
  emailSender = sendPasswordResetEmail,
  notificationWriter = notifyPasswordChanged,
  tokenGenerator = generatePasswordResetToken,
  tokenHasher = hashPasswordResetToken,
  passwordHasher = hashPassword,
  resetUrlBuilder = buildPasswordResetUrl,
  clock = () => new Date(),
  ttlMinutes = PASSWORD_RESET_TTL_MINUTES
} = {}) {
  return {
    async requestReset(email, returnUrl) {
      const rawToken = tokenGenerator();
      const tokenHash = tokenHasher(rawToken);
      const user = await repository.findUserByEmail(email);

      // Environment-only administrators and database administrators are deliberately excluded.
      if (!user || user.role !== "customer") return { accepted: true };

      const requestedAt = clock();
      const expiresAt = new Date(requestedAt.getTime() + ttlMinutes * 60_000);
      await repository.storePasswordResetToken(user._id, { tokenHash, expiresAt, requestedAt });

      try {
        await emailSender({
          to: user.email,
          fullName: user.fullName,
          resetUrl: resetUrlBuilder(rawToken, sanitizePasswordResetReturnUrl(returnUrl)),
          expiresInMinutes: ttlMinutes
        });
      } catch (error) {
        await repository.clearPasswordResetToken(user._id, tokenHash);
        throw error;
      }

      return { accepted: true };
    },

    async resetPassword(rawToken, password) {
      const policy = validatePassword(password);
      if (!policy.valid) return { updated: false, reason: "password_policy", message: policy.message };

      const token = String(rawToken ?? "");
      if (!token || token.length > 512) return { updated: false, reason: "invalid_token" };

      const passwordHash = passwordHasher(password);
      const user = await repository.resetPasswordWithTokenHash(
        tokenHasher(token),
        passwordHash,
        clock()
      );

      if (user) {
        try { await notificationWriter(user); }
        catch (error) {
          // A consumed recovery token must never be reported as failed after changing the password.
          logger.exception("account.notification.failed", error);
        }
      }

      return user
        ? { updated: true }
        : { updated: false, reason: "invalid_token" };
    }
  };
}

export const passwordRecoveryService = createPasswordRecoveryService();
