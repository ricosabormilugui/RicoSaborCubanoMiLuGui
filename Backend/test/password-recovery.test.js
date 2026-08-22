import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../src/lib/auth.js";
import {
  PASSWORD_RECOVERY_GENERIC_MESSAGE,
  PASSWORD_RESET_INVALID_MESSAGE
} from "../src/config/password-recovery.config.js";
import { createPasswordRecoveryHandlers } from "../src/controllers/auth.controller.js";
import { passwordRecoveryRateLimit } from "../src/middleware/password-recovery-rate-limit.middleware.js";
import { authenticateCredentials } from "../src/services/authentication.service.js";
import {
  createPasswordRecoveryService,
  hashPasswordResetToken
} from "../src/services/password-recovery.service.js";

function mockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function createFixture({ hasUser = true, now = new Date("2026-08-23T10:00:00.000Z") } = {}) {
  const user = hasUser
    ? {
        _id: "user-1",
        fullName: "Cliente Prueba",
        email: "cliente@ejemplo.com",
        role: "customer",
        passwordHash: hashPassword("Anterior1")
      }
    : null;
  const sentEmails = [];
  const generatedTokens = ["token-seguro-uno", "token-seguro-dos", "token-seguro-tres"];
  let currentTime = new Date(now);

  const repository = {
    async findUserByEmail(email) {
      return user && String(email ?? "").trim().toLowerCase() === user.email ? user : null;
    },
    async storePasswordResetToken(_userId, values) {
      Object.assign(user, {
        passwordResetTokenHash: values.tokenHash,
        passwordResetExpiresAt: values.expiresAt,
        passwordResetRequestedAt: values.requestedAt
      });
      return user;
    },
    async clearPasswordResetToken(_userId, tokenHash) {
      if (user?.passwordResetTokenHash === tokenHash) {
        delete user.passwordResetTokenHash;
        delete user.passwordResetExpiresAt;
        delete user.passwordResetRequestedAt;
      }
    },
    async resetPasswordWithTokenHash(tokenHash, nextPasswordHash, comparedAt) {
      const valid =
        user?.role === "customer" &&
        user.passwordResetTokenHash === tokenHash &&
        user.passwordResetExpiresAt > comparedAt;
      if (!valid) return null;

      user.passwordHash = nextPasswordHash;
      delete user.passwordResetTokenHash;
      delete user.passwordResetExpiresAt;
      delete user.passwordResetRequestedAt;
      return user;
    }
  };

  const service = createPasswordRecoveryService({
    repository,
    emailSender: async (message) => sentEmails.push(message),
    tokenGenerator: () => generatedTokens.shift(),
    resetUrlBuilder: (token) => `https://rico.test/reset-password#token=${token}`,
    clock: () => new Date(currentTime),
    ttlMinutes: 60
  });

  return {
    user,
    repository,
    service,
    sentEmails,
    setTime(value) {
      currentTime = new Date(value);
    }
  };
}

test("caso 1: una cuenta existente recibe un token y la respuesta pública es genérica", async () => {
  const fixture = createFixture();
  const response = mockResponse();
  const handlers = createPasswordRecoveryHandlers(fixture.service);

  await handlers.forgotPassword({ body: { email: "  CLIENTE@EJEMPLO.COM " } }, response);

  assert.equal(response.statusCode, 202);
  assert.equal(response.body.message, PASSWORD_RECOVERY_GENERIC_MESSAGE);
  assert.equal(fixture.sentEmails.length, 1);
  assert.match(fixture.sentEmails[0].resetUrl, /#token=token-seguro-uno$/);
  assert.equal(fixture.user.passwordResetTokenHash, hashPasswordResetToken("token-seguro-uno"));
  assert.notEqual(fixture.user.passwordResetTokenHash, "token-seguro-uno");
});

test("caso 2: una cuenta inexistente obtiene exactamente la misma respuesta pública", async () => {
  const existing = createFixture();
  const missing = createFixture({ hasUser: false });
  const existingResponse = mockResponse();
  const missingResponse = mockResponse();

  await createPasswordRecoveryHandlers(existing.service).forgotPassword({ body: { email: "cliente@ejemplo.com" } }, existingResponse);
  await createPasswordRecoveryHandlers(missing.service).forgotPassword({ body: { email: "nadie@ejemplo.com" } }, missingResponse);

  assert.equal(missingResponse.statusCode, existingResponse.statusCode);
  assert.deepEqual(missingResponse.body, existingResponse.body);
  assert.equal(missing.sentEmails.length, 0);
});

test("caso 3: un token válido actualiza la contraseña", async () => {
  const fixture = createFixture();
  await fixture.service.requestReset(fixture.user.email);

  const result = await fixture.service.resetPassword("token-seguro-uno", "NuevaClave2");

  assert.equal(result.updated, true);
  assert.equal(verifyPassword("NuevaClave2", fixture.user.passwordHash), true);
});

test("caso 4: un token inexistente se rechaza con un error genérico", async () => {
  const fixture = createFixture();
  const response = mockResponse();
  await createPasswordRecoveryHandlers(fixture.service).resetPassword(
    { body: { token: "no-existe", password: "NuevaClave2" } },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, PASSWORD_RESET_INVALID_MESSAGE);
});

test("caso 5: un token caducado se rechaza", async () => {
  const fixture = createFixture();
  await fixture.service.requestReset(fixture.user.email);
  fixture.setTime("2026-08-23T11:00:00.001Z");

  const result = await fixture.service.resetPassword("token-seguro-uno", "NuevaClave2");

  assert.equal(result.updated, false);
  assert.equal(result.reason, "invalid_token");
});

test("caso 6: un token ya utilizado no puede volver a utilizarse", async () => {
  const fixture = createFixture();
  await fixture.service.requestReset(fixture.user.email);
  assert.equal((await fixture.service.resetPassword("token-seguro-uno", "NuevaClave2")).updated, true);

  const reused = await fixture.service.resetPassword("token-seguro-uno", "OtraClave3");

  assert.equal(reused.updated, false);
  assert.equal(verifyPassword("OtraClave3", fixture.user.passwordHash), false);
});

test("caso 7: una nueva solicitud invalida el token anterior", async () => {
  const fixture = createFixture();
  await fixture.service.requestReset(fixture.user.email);
  await fixture.service.requestReset(fixture.user.email);

  assert.equal((await fixture.service.resetPassword("token-seguro-uno", "NuevaClave2")).updated, false);
  assert.equal((await fixture.service.resetPassword("token-seguro-dos", "NuevaClave2")).updated, true);
});

test("caso 8: el backend rechaza contraseñas que incumplen la política", async () => {
  const fixture = createFixture();
  await fixture.service.requestReset(fixture.user.email);

  const tooShort = await fixture.service.resetPassword("token-seguro-uno", "Abc1");
  const noNumber = await fixture.service.resetPassword("token-seguro-uno", "SinNumeros");

  assert.equal(tooShort.reason, "password_policy");
  assert.equal(noNumber.reason, "password_policy");
  assert.equal(fixture.user.passwordResetTokenHash, hashPasswordResetToken("token-seguro-uno"));
});

test("caso 9: el login rechaza la contraseña antigua después del reset", async () => {
  const fixture = createFixture();
  await fixture.service.requestReset(fixture.user.email);
  await fixture.service.resetPassword("token-seguro-uno", "NuevaClave2");

  const authenticated = await authenticateCredentials(fixture.user.email, "Anterior1", {
    findUser: fixture.repository.findUserByEmail
  });

  assert.equal(authenticated, null);
});

test("caso 10: el login acepta la contraseña nueva después del reset", async () => {
  const fixture = createFixture();
  await fixture.service.requestReset(fixture.user.email);
  await fixture.service.resetPassword("token-seguro-uno", "NuevaClave2");

  const authenticated = await authenticateCredentials(fixture.user.email, "NuevaClave2", {
    findUser: fixture.repository.findUserByEmail
  });

  assert.equal(authenticated?._id, fixture.user._id);
});

test("el rate limit responde de forma genérica al superar el máximo por email", () => {
  const middleware = passwordRecoveryRateLimit({ windowMs: 60_000, maxPerEmail: 1, maxPerIp: 10, now: () => 1_000 });
  const request = { body: { email: "cliente@ejemplo.com" }, ip: "127.0.0.1" };
  middleware(request, mockResponse(), () => {});
  const response = mockResponse();
  let continued = false;

  middleware(request, response, () => { continued = true; });

  assert.equal(continued, false);
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.message, PASSWORD_RECOVERY_GENERIC_MESSAGE);
});
