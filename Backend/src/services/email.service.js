function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export async function sendOrderEmail(order) {
  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("NOTIFY_EMAIL_FROM");
  const to = getRequiredEnv("NOTIFY_EMAIL_TO");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Nuevo pedido ${order.orderId} · MiLuGui`,
      html: `
        <h2>Nuevo pedido: ${order.orderId}</h2>
        <p><strong>Cliente:</strong> ${order.customer?.fullName ?? "N/A"}</p>
        <p><strong>Teléfono:</strong> ${order.customer?.phone ?? "N/A"}</p>
        <p><strong>Total:</strong> ${order.total ?? 0} EUR</p>
      `
    })
  });
}
