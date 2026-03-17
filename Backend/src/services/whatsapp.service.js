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
  return String(phone ?? "")
    .replace(/[^0-9]/g, "")
    .replace(/^0+/, "");
}

function isValidNormalizedPhone(phone) {
  return /^[0-9]{9,15}$/.test(phone);
}

export async function sendWhatsAppToPhone(phone, message) {
  if (!isWhatsAppEnabled) {
    throw new Error("WhatsApp disabled (set WHATSAPP_ENABLED=true)");
  }

  const normalized = normalizePhone(phone);
  if (!normalized || !isValidNormalizedPhone(normalized)) {
    throw new Error("Invalid target phone for WhatsApp");
  }

  await initializeWhatsApp();

  if (!isClientReady) {
    throw new Error("WhatsApp client not ready (scan QR first)");
  }

  const chatId = `${normalized}@c.us`;
  console.log(`Sending WhatsApp to ${normalized}`);
  await getClient().sendMessage(chatId, message);
  console.log(`WhatsApp message sent to ${normalized}`);
}

export async function sendWhatsAppNotification(message) {
  const phone = process.env.NOTIFY_WHATSAPP_TO;
  if (!phone) {
    throw new Error("Missing NOTIFY_WHATSAPP_TO");
  }

  await sendWhatsAppToPhone(phone, message);
}
