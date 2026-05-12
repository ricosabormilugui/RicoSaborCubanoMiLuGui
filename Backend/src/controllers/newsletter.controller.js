import { subscribeCustomerToNewsletter } from "../repositories/customers.repository.js";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? "").trim());
}

export async function subscribeNewsletter(req, res) {
  try {
    const { email, consent } = req.body ?? {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "Email inválido" });
    }

    if (consent !== true) {
      return res.status(400).json({ ok: false, error: "Consentimiento legal requerido" });
    }

    const result = await subscribeCustomerToNewsletter({
      email,
      consent: true,
      source: "footer_newsletter"
    });

    return res.status(200).json({
      ok: true,
      duplicated: Boolean(result?.duplicated),
      discount: result?.discount ?? { code: "PRIMER10", percent: 10, status: "available" }
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({ ok: true, duplicated: true });
    }

    return res.status(500).json({ ok: false, error: error.message ?? "Unexpected error" });
  }
}
