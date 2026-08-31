import { logger } from "../lib/logger.js";
import { paymentSettingsService } from "../services/payment-settings.service.js";

function clientErrorMessage(error) {
  return error?.message ?? "No se pudo guardar la configuración de pagos.";
}

export function createPaymentSettingsHandlers(service = paymentSettingsService) {
  async function getPublicPaymentSettings(_req, res) {
    try {
      const payment = await service.toPublic();
      return res.status(200).json({ payment: payment });
    } catch (error) {
      logger.error("payment.settings.public.failed", { error: error.message ?? "Unexpected error" });
      return res.status(500).json({ error: "No se pudo cargar la configuración de pagos." });
    }
  }

  async function getPaymentSettingsForAdmin(_req, res) {
    try {
      const payment = await service.toAdmin();
      return res.status(200).json({ payment });
    } catch (error) {
      logger.error("payment.settings.admin.get.failed", { error: error.message ?? "Unexpected error" });
      return res.status(500).json({ error: "No se pudo cargar la configuración de pagos." });
    }
  }

  async function updatePaymentSettingsForAdmin(req, res) {
    try {
      const updatedBy = String(req.auth?.email ?? req.auth?.sub ?? "").trim() || "admin";
      await service.save(req.body ?? {}, { updatedBy });
      return res.status(200).json({ payment: await service.toAdmin() });
    } catch (error) {
      if (error?.status === 400 || Array.isArray(error?.fields)) {
        return res.status(400).json({
          error: clientErrorMessage(error),
          fields: error.fields ?? []
        });
      }
      logger.error("payment.settings.admin.update.failed", { error: error.message ?? "Unexpected error" });
      return res.status(500).json({ error: "No se pudo guardar la configuración de pagos." });
    }
  }

  return {
    getPublicPaymentSettings,
    getPaymentSettingsForAdmin,
    updatePaymentSettingsForAdmin
  };
}

const defaultHandlers = createPaymentSettingsHandlers();

export const getPublicPaymentSettings = defaultHandlers.getPublicPaymentSettings;
export const getPaymentSettingsForAdmin = defaultHandlers.getPaymentSettingsForAdmin;
export const updatePaymentSettingsForAdmin = defaultHandlers.updatePaymentSettingsForAdmin;
