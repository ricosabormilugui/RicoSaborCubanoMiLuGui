import { LEGAL_NAV_LINKS } from './legal-links.config';
import { BRAND_CONFIG } from './brand.config';
import contactConfig from '../../../../shared/contact.config.json';

export interface LegalBusinessConfig {
  tradeName: string;
  legalName: string;
  taxId: string;
  fiscalAddress: string;
  legalEmail: string;
  phone: string;
  bankAccountHolder: string;
  jurisdiction: string;
  lastUpdated: string;
}

export interface LegalDocumentSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDocument {
  slug: string;
  title: string;
  summary: string;
  sections: LegalDocumentSection[];
}

export function isPendingLegalValue(value: string): boolean {
  return !value || String(value).startsWith('PENDIENTE_CONFIGURAR_');
}

export function displayLegalValue(value: string, fallback = 'Pendiente de publicación'): string {
  return isPendingLegalValue(value) ? fallback : value;
}

function formatPublicPhone(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('34') && digits.length >= 11) {
    return `+34 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return digits;
}

export const LEGAL_BUSINESS_CONFIG: LegalBusinessConfig = {
  tradeName: BRAND_CONFIG.name,
  legalName: 'PENDIENTE_CONFIGURAR_RAZON_SOCIAL',
  taxId: 'PENDIENTE_CONFIGURAR_CIF_NIF',
  fiscalAddress: 'PENDIENTE_CONFIGURAR_DIRECCION_FISCAL',
  legalEmail: contactConfig.salesEmail,
  phone: formatPublicPhone(contactConfig.whatsappPhone),
  bankAccountHolder: 'PENDIENTE_CONFIGURAR_TITULAR_BANCARIO',
  jurisdiction: 'España / Unión Europea',
  lastUpdated: '12/05/2026'
} as const;

export const LEGAL_IDENTITY_DISPLAY = {
  tradeName: LEGAL_BUSINESS_CONFIG.tradeName,
  legalName: displayLegalValue(LEGAL_BUSINESS_CONFIG.legalName),
  taxId: displayLegalValue(LEGAL_BUSINESS_CONFIG.taxId),
  fiscalAddress: displayLegalValue(LEGAL_BUSINESS_CONFIG.fiscalAddress),
  legalEmail: LEGAL_BUSINESS_CONFIG.legalEmail,
  phone: LEGAL_BUSINESS_CONFIG.phone
} as const;

const identityParagraph = `El sitio opera bajo el nombre comercial ${LEGAL_BUSINESS_CONFIG.tradeName}. Email de contacto: ${LEGAL_BUSINESS_CONFIG.legalEmail}. Teléfono/WhatsApp: ${LEGAL_BUSINESS_CONFIG.phone}. La razón social, el CIF/NIF y el domicilio fiscal definitivos se publicarán cuando estén confirmados por asesoría legal.`;

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    slug: 'aviso-legal',
    title: LEGAL_NAV_LINKS[0].title,
    summary: 'Información del titular del sitio, condiciones generales de uso y responsabilidades básicas.',
    sections: [
      {
        title: 'Titularidad del sitio',
        paragraphs: [identityParagraph, `Este sitio opera bajo el nombre comercial ${LEGAL_BUSINESS_CONFIG.tradeName}. Los datos identificativos de razón social, CIF/NIF y domicilio fiscal se publicarán cuando estén confirmados.`]
      },
      {
        title: 'Uso del sitio',
        paragraphs: ['La persona usuaria se compromete a utilizar la web de forma lícita, diligente y respetuosa, sin dañar el servicio ni impedir su uso por terceros.', 'Los contenidos, precios, disponibilidad y horarios pueden actualizarse para reflejar cambios operativos del negocio.']
      },
      {
        title: 'Responsabilidad',
        paragraphs: ['Trabajamos para mantener la información actualizada, pero pueden existir errores puntuales de disponibilidad, precio o descripción. En caso de incidencia contactaremos antes de confirmar definitivamente el pedido.', 'Los enlaces a canales externos como WhatsApp se ofrecen como vía opcional de comunicación.']
      }
    ]
  },
  {
    slug: 'privacidad',
    title: LEGAL_NAV_LINKS[1].title,
    summary: 'Tratamiento de datos de clientes, pedidos, contactos y newsletter conforme a una base legal básica para ecommerce España/UE.',
    sections: [
      {
        title: 'Responsable y contacto',
        paragraphs: [identityParagraph, 'Para ejercer derechos de acceso, rectificación, supresión, oposición, limitación o portabilidad, escribe al email legal indicado.']
      },
      {
        title: 'Datos tratados',
        paragraphs: ['Podemos tratar nombre, teléfono, email, dirección de entrega, notas de pedido, historial de pedidos, consentimiento de promociones y mensajes enviados por formularios de contacto.', 'No solicitamos datos de tarjeta ni integramos pasarela online en este momento. Los pagos manuales se validan fuera de la web.']
      },
      {
        title: 'Finalidades y base jurídica',
        paragraphs: ['Usamos los datos para gestionar pedidos, atención al cliente, facturación/obligaciones legales, prevención de duplicados y comunicaciones solicitadas.', 'La newsletter y promociones se envían solo si existe consentimiento expreso. Puedes retirar el consentimiento contactándonos.']
      },
      {
        title: 'Conservación y destinatarios',
        paragraphs: ['Conservaremos los datos durante los plazos necesarios para la relación comercial y obligaciones legales aplicables.', 'Podrán acceder proveedores técnicos necesarios para operar la web, email, hosting, base de datos o mensajería, bajo criterios de confidencialidad y seguridad.']
      }
    ]
  },
  {
    slug: 'cookies',
    title: LEGAL_NAV_LINKS[2].title,
    summary: 'Información sobre cookies necesarias, analíticas y de marketing, y cómo gestionar el consentimiento.',
    sections: [
      {
        title: 'Qué son las cookies',
        paragraphs: ['Las cookies y tecnologías similares permiten recordar preferencias, mantener funciones de la web y, si lo aceptas, medir uso o activar comunicaciones de marketing.', 'Actualmente el consentimiento se guarda en localStorage del navegador.']
      },
      {
        title: 'Categorías',
        paragraphs: ['Necesarias: imprescindibles para funciones básicas como preferencias técnicas, carrito local y seguridad. No se pueden desactivar desde el banner.', 'Analíticas: ayudan a entender el uso de la web. No deben cargarse si no das consentimiento.', 'Marketing: permiten medir o personalizar campañas. No deben cargarse si no das consentimiento.']
      },
      {
        title: 'Cómo configurar',
        paragraphs: ['Puedes aceptar, rechazar o configurar las categorías desde el banner de cookies. Si deseas cambiar tu decisión, borra los datos del sitio en el navegador o vuelve a abrir la configuración cuando esté disponible en el footer.', 'No se integra una CMP externa ni scripts opcionales de terceros por defecto.']
      }
    ]
  },
  {
    slug: 'condiciones-compra',
    title: LEGAL_NAV_LINKS[3].title,
    summary: 'Condiciones aplicables a pedidos, pago manual, confirmación y disponibilidad.',
    sections: [
      {
        title: 'Proceso de pedido',
        paragraphs: ['Al enviar el checkout recibimos tu solicitud de pedido. El pedido queda pendiente de pago y de validación operativa.', 'La confirmación definitiva se realizará tras validar el pago manual y disponibilidad.']
      },
      {
        title: 'Pagos manuales',
        paragraphs: ['Los métodos de pago disponibles (Bizum, transferencia o efectivo) se muestran en el checkout según la configuración vigente. El pedido queda pendiente hasta validar el pago manualmente.', 'No introduzcas datos sensibles de tarjetas en notas o formularios.']
      },
      {
        title: 'Precios y disponibilidad',
        paragraphs: ['Los importes se muestran en euros. Si detectamos un error de precio o disponibilidad, contactaremos antes de continuar.', 'Las promociones como CUPONES requieren validación manual y pueden estar sujetas a condiciones operativas.']
      }
    ]
  },
  {
    slug: 'envios',
    title: LEGAL_NAV_LINKS[4].title,
    summary: 'Información de entrega, recogida, franjas horarias y datos necesarios.',
    sections: [
      {
        title: 'Entrega y recogida',
        paragraphs: ['El checkout permite elegir entrega a domicilio o recogida, fecha y franja disponible.', 'Para entrega a domicilio solicitaremos dirección y referencia para poder coordinar el reparto.']
      },
      {
        title: 'Horarios e incidencias',
        paragraphs: ['Las franjas pueden variar según disponibilidad, festivos, cierre semanal o volumen de pedidos.', 'Si hay una incidencia de entrega, contactaremos por teléfono o email; WhatsApp queda como canal manual opcional iniciado por el cliente.']
      }
    ]
  },
  {
    slug: 'devoluciones-cancelaciones',
    title: LEGAL_NAV_LINKS[5].title,
    summary: 'Criterios básicos para cancelaciones, productos perecederos/incidencias y reembolsos manuales.',
    sections: [
      {
        title: 'Cancelaciones',
        paragraphs: ['Puedes solicitar la cancelación contactándonos lo antes posible. Si el pedido ya está en preparación o reparto, la cancelación puede no ser posible.', 'Los pedidos pendientes de pago pueden anularse si no se valida el pago en plazo razonable.']
      },
      {
        title: 'Devoluciones e incidencias',
        paragraphs: ['Por tratarse de alimentos o productos preparados/perecederos, las devoluciones pueden estar limitadas por normativa de higiene y consumo.', 'Si recibes un producto incorrecto, dañado o con incidencia, contacta con fotos y número de pedido para valorar solución, sustitución o reembolso manual.']
      },
      {
        title: 'Reembolsos',
        paragraphs: ['Cuando proceda, el reembolso se realizará por el mismo canal manual o medio acordado con el cliente.', 'La gestión puede requerir verificar identidad, pedido y método de pago.']
      }
    ]
  }
];

export function getLegalDocument(slug: string | null | undefined): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((document) => document.slug === slug);
}
