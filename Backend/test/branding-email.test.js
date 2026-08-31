import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BRAND_CONFIG } from "../src/config/brand.config.js";

test("la configuración compartida del backend usa MIXSABOR", () => {
  assert.equal(BRAND_CONFIG.name, "MIXSABOR");
  assert.equal(BRAND_CONFIG.slogan, "Sabores que se encuentran");
});

test("las plantillas activas de email no contienen branding antiguo", () => {
  const emailSource = readFileSync(new URL("../src/services/email.service.js", import.meta.url), "utf8");
  const templatesSource = readFileSync(new URL("../src/services/order-email.templates.js", import.meta.url), "utf8");
  const contactSource = readFileSync(new URL("../src/controllers/admin-contacts.controller.js", import.meta.url), "utf8");

  assert.match(emailSource, /BRAND_CONFIG\.name/);
  assert.match(templatesSource, /BRAND_CONFIG\.name/);
  assert.doesNotMatch(`${emailSource}\n${templatesSource}\n${contactSource}`, /Rico Sabor|MiLuGui/i);
});

