import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const { Client, LocalAuth } = pkg;

const client = new Client({
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
  console.log("WhatsApp conectado correctamente");
});

client.on("authenticated", () => {
  console.log("WhatsApp autenticado");
});
client.on("disconnected", (reason) => {
  console.warn("WhatsApp desconectado:", reason);
});

client.initialize();

export async function sendWhatsAppNotification(message) {
  try {
    const phone = process.env.NOTIFY_WHATSAPP_TO;

    if (!phone) {
      return;
    }

    const chatId = `${phone}@c.us`;
    await client.sendMessage(chatId, message);
  } catch (error) {
    console.error("Error enviando WhatsApp:", error.message);
  }
}
