import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const { Client, LocalAuth } = pkg;

const isWhatsAppEnabled = process.env.WHATSAPP_ENABLED === "true";
let client;
let isClientReady = false;
let initPromise;

function getClient() {
  if (!client) {
    client = new Client({
      authStrategy: new LocalAuth({
        clientId: "milugui-whatsapp",
        dataPath: ".wwebjs_auth"
      })
    });

    client.on("qr", (qr) => {
      console.log("Escanea el QR con WhatsApp Business:");
      qrcode.generate(qr, { small: true });
    });

    client.on("ready", () => {
      isClientReady = true;
      console.log("WhatsApp conectado correctamente");
    });

    client.on("authenticated", () => {
      console.log("WhatsApp autenticado");
    });

    client.on("disconnected", (reason) => {
      isClientReady = false;
      console.warn("WhatsApp desconectado:", reason);
    });
  }

  return client;
}

async function initializeWhatsApp() {
  if (!isWhatsAppEnabled) {
    return;
  }

  if (!initPromise) {
    const whatsappClient = getClient();
    initPromise = whatsappClient.initialize().catch((error) => {
      isClientReady = false;
      console.error("No se pudo inicializar WhatsApp:", error.message);
      return null;
    });
  }

  await initPromise;
}

void initializeWhatsApp();

function normalizePhone(phone) {
  return String(phone ?? "").replace(/[^0-9]/g, "");
}

export async function sendWhatsAppToPhone(phone, message) {
  if (!isWhatsAppEnabled) return;

  const normalized = normalizePhone(phone);
  if (!normalized) return;

  await initializeWhatsApp();

  if (!isClientReady) {
    console.warn("WhatsApp no está listo; se omite la notificación.");
    return;
  }

  try {
    const chatId = `${normalized}@c.us`;
    await getClient().sendMessage(chatId, message);
  } catch (error) {
    console.error("Error enviando WhatsApp:", error.message);
  }
}

export async function sendWhatsAppNotification(message) {
  const phone = process.env.NOTIFY_WHATSAPP_TO;
  if (!phone) return;

  await sendWhatsAppToPhone(phone, message);
}
