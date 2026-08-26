import { notificationsRepository } from "../repositories/notifications.repository.js";
import { randomUUID } from "node:crypto";

const statusMessages = {
  nuevo: ["Pedido recibido", "Hemos recibido tu pedido"],
  confirmado: ["Pedido confirmado", "Hemos confirmado tu pedido"],
  preparando: ["Estamos cocinando", "Estamos preparando tu pedido"],
  listo: ["Pedido listo", "Tu pedido está listo"],
  enviado: ["Pedido en camino", "Tu pedido va en camino"],
  entregado: ["Pedido entregado", "Tu pedido se ha entregado"],
  cancelado: ["Pedido cancelado", "Se ha cancelado tu pedido"],
  anulado: ["Pedido anulado", "Se ha anulado tu pedido"]
};

export async function notifyOrderOwner(order, { session, repository = notificationsRepository } = {}) {
  // Never infer a recipient from email, customerId, or request-body notification fields.
  if (order.accountMode !== "registered" || !order.userId) return;
  const copy = statusMessages[order.status];
  if (!copy) return;
  const revision = order.statusHistory?.length ?? 1;
  await repository.create({
    userId: String(order.userId), type: "order", title: copy[0],
    message: `${copy[1]} ${order.orderId}.`,
    eventKey: `order:${order.orderId}:status:${revision}`,
    action: { label: "Ver mis pedidos", url: "/mis-pedidos" },
    entity: { type: "order", id: order.orderId }
  }, { session });
}

export async function notifyPasswordChanged(user, { repository = notificationsRepository } = {}) {
  await repository.create({
    userId: String(user._id), type: "account", title: "Contraseña actualizada",
    message: "La contraseña de tu cuenta se ha actualizado. Si no has sido tú, ponte en contacto con nosotros.",
    eventKey: `password-changed:${randomUUID()}`,
    action: { label: "Contactar", url: "/contacto" }, entity: null
  });
}
