// lib/uscis.js — consulta el API de USCIS y formatea la respuesta

const EVENT_CODES = {
  IAF:  "Caso recibido por USCIS",
  FTA0: "Biometría reutilizada (no necesitas cita)",
  RFE:  "Solicitud de evidencia adicional (RFE)",
  RFEC: "Respuesta a RFE recibida",
  APD:  "✅ Caso APROBADO",
  DND:  "❌ Caso denegado",
  TRF:  "Caso transferido a otra oficina",
  INT:  "Entrevista programada",
  NTA:  "Aviso de comparecencia",
  WLC:  "Carta de bienvenida enviada",
  CPO:  "Tarjeta en producción",
  CPD:  "Tarjeta entregada",
  CSC:  "Cambio de estatus",
};

const FORM_NAMES = {
  "I-751": "Petición para remover condiciones de residencia",
  "I-485": "Solicitud de residencia permanente",
  "I-130": "Petición familiar",
  "N-400": "Solicitud de naturalización",
  "I-765": "Autorización de empleo",
  "I-131": "Permiso de viaje / Advance Parole",
};

export async function fetchUSCISCase(receiptNumber) {
  const receipt = receiptNumber.trim().toUpperCase();

  if (!/^[A-Z]{3}\d{10}$/.test(receipt)) {
    return { error: "formato_invalido" };
  }

  try {
    const res = await fetch(
      `https://egov.uscis.gov/csol-api/case-statuses/${receipt}`,
      { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } }
    );

    if (res.status === 404) return { error: "no_encontrado" };
    if (!res.ok) return { error: "uscis_error", status: res.status };

    const json = await res.json();
    return { data: json.data || json };
  } catch (e) {
    return { error: "conexion_fallida" };
  }
}

export function formatCaseMessage(data) {
  const events = [...(data.events || [])].sort(
    (a, b) => new Date(b.eventTimestamp) - new Date(a.eventTimestamp)
  );

  const latestEvent = events[0];
  const formDesc = FORM_NAMES[data.formType] || data.formName;

  // Status badge
  let statusEmoji = "🟡";
  if (data.closed) statusEmoji = "⚫";
  else if (data.actionRequired) statusEmoji = "🔴";
  else if (events.some(e => e.eventCode === "APD")) statusEmoji = "✅";
  else statusEmoji = "🟢";

  let msg = `${statusEmoji} *${data.receiptNumber}*\n`;
  msg += `📋 ${data.formType} — ${formDesc}\n`;
  msg += `👤 ${data.applicantName}\n\n`;

  // Status
  if (data.closed) msg += `⚫ *Estado: Cerrado*\n`;
  else if (data.actionRequired) msg += `🔴 *Acción requerida*\n`;
  else msg += `🟢 *Estado: Activo*\n`;

  if (data.areAllGroupMembersAuthorizedForTravel) {
    msg += `✈️ Autorizado para viajar\n`;
  }

  msg += `\n📅 *Último evento:*\n`;

  if (latestEvent) {
    const date = new Date(latestEvent.eventTimestamp).toLocaleDateString(
      "es-MX", { year: "numeric", month: "long", day: "numeric" }
    );
    const desc = EVENT_CODES[latestEvent.eventCode] || latestEvent.eventCode;
    msg += `• *${latestEvent.eventCode}* — ${desc}\n`;
    msg += `• ${date}\n`;
  }

  // Timeline de últimos 3 eventos únicos
  const uniqueEvents = [];
  const seenCodes = new Set();
  for (const ev of events) {
    if (!seenCodes.has(ev.eventCode)) {
      uniqueEvents.push(ev);
      seenCodes.add(ev.eventCode);
    }
    if (uniqueEvents.length >= 3) break;
  }

  if (uniqueEvents.length > 1) {
    msg += `\n📌 *Historial reciente:*\n`;
    for (const ev of uniqueEvents) {
      const d = new Date(ev.eventTimestamp).toLocaleDateString("es-MX", {
        month: "short", day: "numeric", year: "numeric"
      });
      msg += `• ${d} — ${EVENT_CODES[ev.eventCode] || ev.eventCode}\n`;
    }
  }

  msg += `\n🕒 _Actualizado: ${new Date(data.updatedAtTimestamp).toLocaleDateString("es-MX", { month: "long", day: "numeric", year: "numeric" })}_`;

  return msg;
}

export function formatError(errorCode, receipt) {
  switch (errorCode) {
    case "formato_invalido":
      return `❌ El número *${receipt}* no tiene el formato correcto.\n\nDebe ser 3 letras + 10 números.\nEjemplo: *IOE0931774969*`;
    case "no_encontrado":
      return `❌ No encontré el caso *${receipt}*.\n\nVerifica que el número sea correcto. Puede tardar hasta 2 semanas en aparecer después de presentar tu petición.`;
    case "uscis_error":
    case "conexion_fallida":
      return `⚠️ No pude conectar con USCIS en este momento. Intenta de nuevo en unos minutos.`;
    default:
      return `⚠️ Error inesperado. Intenta de nuevo.`;
  }
}
