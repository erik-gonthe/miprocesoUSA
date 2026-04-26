// ============================================
// PRICING CONFIG — edita esto cuando quieras
// ============================================

export const PRICES = {
  single: {
    label: "Consulta única",
    amount: 199,        // $1.99 USD en centavos
    currency: "usd",
    type: "one_time",
  },
  monthly: {
    label: "Suscripción mensual",
    amount: 499,        // $4.99 USD
    currency: "usd",
    type: "subscription",
    interval: "month",
  },
  annual: {
    label: "Suscripción anual",
    amount: 2999,       // $29.99 USD
    currency: "usd",
    type: "subscription",
    interval: "year",
  },
};

// ============================================
// PROMO CODES — agrega/quita cuando quieras
// ============================================
// discount: porcentaje de descuento (0-100)
// freeQueries: consultas gratis que da el código
// plan: si aplica solo a un plan específico (null = todos)
// maxUses: límite de usos (null = ilimitado)
// expiresAt: fecha de expiración (null = no expira)

export const PROMO_CODES = {
  // Código de lanzamiento — 50% off cualquier plan
  LAUNCH50: {
    discount: 50,
    freeQueries: 0,
    plan: null,
    maxUses: 500,
    expiresAt: "2025-12-31",
    description: "50% descuento de lanzamiento",
  },

  // Para influencers / grupos de Facebook
  GRATIS1: {
    discount: 100,
    freeQueries: 1,
    plan: "single",
    maxUses: 1000,
    expiresAt: null,
    description: "1 consulta gratis",
  },

  // Para partners / abogados que refieren clientes
  ABOGADO30: {
    discount: 30,
    freeQueries: 0,
    plan: null,
    maxUses: null,
    expiresAt: null,
    description: "30% off para clientes referidos",
  },

  // Para anual — descuento extra
  ANNUAL50: {
    discount: 50,
    freeQueries: 0,
    plan: "annual",
    maxUses: 200,
    expiresAt: "2025-12-31",
    description: "50% off plan anual",
  },
};

// ============================================
// MENSAJES DEL BOT
// ============================================
export const MESSAGES = {
  welcome: `👋 Hola! Soy el asistente de seguimiento de casos USCIS.

Puedo consultar el estatus de tu caso al instante.

📋 *¿Qué quieres hacer?*
1️⃣ Consultar mi caso
2️⃣ Ver planes y precios
3️⃣ Ingresar código promocional

Responde con el número de tu elección.`,

  askReceipt: `🔢 Envíame tu número de recibo.

Ejemplo: *IOE0931774969*

Lo encuentras en cualquier carta o notificación de USCIS.`,

  pricing: `💰 *Planes disponibles:*

🔹 *Consulta única* — $1.99
Una consulta inmediata

🔹 *Mensual* — $4.99/mes
Consultas ilimitadas + alertas automáticas cuando tu caso se actualice

🔹 *Anual* — $29.99/año
Todo lo del mensual + prioridad de soporte
_(Ahorra $29 vs mensual)_

¿Tienes un código promocional? Escríbelo ahora.

Responde *1*, *2* o *3* para seleccionar un plan.`,

  promoPrompt: `🎟️ Escribe tu código promocional:`,

  disclaimer: `\n\n_ℹ️ Información obtenida de uscis.gov. No somos abogados. Para asesoría legal consulta un profesional de inmigración._`,
};
