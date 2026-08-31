import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCustomerOrderEmail, buildOrderStatusEmail } from "../src/services/order-email.templates.js";

const env = {
  PAYMENT_BIZUM_PHONE: process.env.PAYMENT_BIZUM_PHONE || "+34644339404",
  PAYMENT_BANK_IBAN: process.env.PAYMENT_BANK_IBAN || "ES7515632626343269629293",
  PAYMENT_BANK_HOLDER: process.env.PAYMENT_BANK_HOLDER || "AMED PUENTES PADRÓN",
  PAYMENT_CASH_INSTRUCTIONS: process.env.PAYMENT_CASH_INSTRUCTIONS || "Pagar en efectivo al recibir o recoger el pedido.",
  FRONTEND_URL: process.env.FRONTEND_URL || "https://mixsabor.milugui.com"
};

function baseOrder(overrides = {}) {
  return {
    orderId: "MLG-PREVIEW",
    customer: { fullName: "Ana Cliente", email: "ana@example.com", phone: "600000000" },
    deliveryType: "delivery",
    delivery: {
      type: "delivery",
      date: "2026-09-05",
      slot: "18:00-21:00",
      address: "Calle Mayor 1",
      reference: "Portero"
    },
    payment: { method: "bizum", status: "pending" },
    shipping: { cost: 5, zoneName: "Alcorcón", postalCode: "28922" },
    shippingCost: 5,
    discountAmount: 5,
    couponCode: "PRIMER10",
    discountPercent: 10,
    items: [{
      name: "Tarta Capuchino Cubano",
      unitPrice: 40,
      quantity: 2,
      requiresAdvancePayment: true,
      customization: [
        { label: "Tamaño", value: "Mediana · 20 cm · 10–12 porciones", priceModifier: 15 },
        { label: "Bizcocho", value: "Vainilla" },
        { label: "Relleno", value: "Guayaba" },
        { label: "Cobertura", value: "Merengue italiano" }
      ]
    }],
    subtotal: 80,
    total: 80,
    notes: "Sin frutos secos",
    requiresAdvancePayment: true,
    ...overrides
  };
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "tmp");
mkdirSync(outDir, { recursive: true });

const bizum = buildCustomerOrderEmail(baseOrder(), { env });
const transfer = buildCustomerOrderEmail(baseOrder({
  payment: { method: "bank_transfer", status: "pending" },
  requiresAdvancePayment: false
}), { env });
const cashDelivery = buildCustomerOrderEmail(baseOrder({
  payment: { method: "cash", status: "pending" },
  requiresAdvancePayment: false
}), { env });
const cashPickup = buildCustomerOrderEmail(baseOrder({
  payment: { method: "cash", status: "pending" },
  deliveryType: "pickup",
  delivery: { type: "pickup", date: "2026-09-05", slot: "12:00-14:00" },
  shippingCost: 0,
  shipping: { cost: 0, zoneName: "Alcorcón", postalCode: "28922" },
  total: 75,
  requiresAdvancePayment: false
}), { env });
const status = buildOrderStatusEmail(baseOrder(), { status: "preparando" }, { env });

writeFileSync(join(outDir, "order-email-customer.html"), bizum.html);
writeFileSync(join(outDir, "order-email-bizum.html"), bizum.html);
writeFileSync(join(outDir, "order-email-transfer.html"), transfer.html);
writeFileSync(join(outDir, "order-email-cash.html"), cashDelivery.html);
writeFileSync(join(outDir, "order-email-cash-pickup.html"), cashPickup.html);
writeFileSync(join(outDir, "order-email-status.html"), status.html);
console.log(`HTML escrito en ${outDir}`);
