// api/whatsapp.js — Webhook principal del bot
// Deploy en Vercel como serverless function

import { fetchUSCISCase, formatCaseMessage, formatError } from "../lib/uscis.js";
import { validatePromoCode, applyDiscount, formatPriceMessage } from "../lib/promos.js";
import { MESSAGES, PRICES } from "../config/pricing.js";

// ─── In-memory session store ───────────────────────────────────────────────
// En producción reemplaza con Redis o una DB (PlanetScale, Supabase, etc.)
const sessions = new Map();

function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, {
      step: "welcome",
      freeUsed: false,
      promoCode: null,
      selectedPlan: null,
      pendingReceipt: null,
    });
  }
  return sessions.get(phone);
}

function setSession(phone, updates) {
  const session = getSession(phone);
  sessions.set(phone, { ...session, ...updates });
}

// ─── Send WhatsApp message ─────────────────────────────────────────────────
async function sendMessage(to, text) {
  await fetch(
    `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );
}

// ─── Generate Stripe payment link ─────────────────────────────────────────
async function createPaymentLink(phone, plan, promoCode) {
  const priceResult = applyDiscount(plan, promoCode);

  // Si es gratis, no necesita Stripe
  if (priceResult.isFree) {
    return { free: true };
  }

  const priceData = {
    currency: priceResult.currency,
    unit_amount: priceResult.finalAmount,
    ...(priceResult.type === "subscription"
      ? { recurring: { interval: priceResult.interval } }
      : {}),
    product_data: { name: `USCIS Bot — ${priceResult.label}` },
  };

  const res = await fetch("https://api.stripe.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "line_items[0][price_data][currency]": priceData.currency,
      "line_items[0][price_data][unit_amount]": priceData.unit_amount,
      "line_items[0][price_data][product_data][name]": priceData.product_data.name,
      ...(priceResult.type === "subscription"
        ? { "line_items[0][price_data][recurring][interval]": priceResult.interval }
        : {}),
      "line_items[0][quantity]": "1",
      "metadata[phone]": phone,
      "metadata[plan]": plan,
      "after_completion[type]": "redirect",
      "after_completion[redirect][url]": `${process.env.APP_URL}/success`,
    }),
  });

  const data = await res.json();
  return { url: data.url };
}

// ─── Main message handler ─────────────────────────────────────────────────
async function handleMessage(phone, text) {
  const session = getSession(phone);
  const msg = text.trim();

  // ── Step: Welcome ──────────────────────────────────────────────────
  if (session.step === "welcome" || msg.toLowerCase() === "hola" || msg === "menu") {
    setSession(phone, { step: "main_menu" });
    return MESSAGES.welcome;
  }

  // ── Step: Main menu ────────────────────────────────────────────────
  if (session.step === "main_menu") {
    if (msg === "1") {
      // Verificar si tiene suscripción activa o free query disponible
      if (!session.freeUsed) {
        setSession(phone, { step: "awaiting_receipt" });
        return `${MESSAGES.askReceipt}\n\n_Tu primera consulta es *gratis*_ 🎁`;
      }
      setSession(phone, { step: "ask_payment_or_promo" });
      return `Para consultar tu caso necesitas un plan activo.\n\n${MESSAGES.pricing}`;
    }
    if (msg === "2") {
      setSession(phone, { step: "select_plan" });
      return MESSAGES.pricing;
    }
    if (msg === "3") {
      setSession(phone, { step: "awaiting_promo" });
      return MESSAGES.promoPrompt;
    }
    return `Por favor responde *1*, *2* o *3*.\n\n${MESSAGES.welcome}`;
  }

  // ── Step: Awaiting promo code ──────────────────────────────────────
  if (session.step === "awaiting_promo") {
    const validation = validatePromoCode(msg);
    if (!validation.valid) {
      return `${validation.message}\n\nIntenta de nuevo o escribe *menu* para volver.`;
    }
    setSession(phone, { step: "main_menu", promoCode: validation.code });
    return `${validation.message}\n\nCódigo guardado ✅\n\n${MESSAGES.welcome}`;
  }

  // ── Step: Select plan ──────────────────────────────────────────────
  if (session.step === "select_plan" || session.step === "ask_payment_or_promo") {
    const planMap = { "1": "single", "2": "monthly", "3": "annual" };
    const plan = planMap[msg];

    if (!plan) {
      // Check if it's a promo code input
      if (msg.length >= 4 && msg.length <= 20 && /^[A-Z0-9]+$/i.test(msg)) {
        const validation = validatePromoCode(msg);
        if (validation.valid) {
          setSession(phone, { promoCode: validation.code });
          return `${validation.message}\n\nAhora selecciona tu plan:\n\n${MESSAGES.pricing}`;
        }
      }
      return `Responde *1*, *2* o *3* para seleccionar.\n\n¿Tienes código promo? Escríbelo directamente.`;
    }

    const priceResult = applyDiscount(plan, session.promoCode);
    const priceMsg = formatPriceMessage(priceResult);

    setSession(phone, { selectedPlan: plan, step: "confirming_payment" });

    if (priceResult.isFree) {
      setSession(phone, { step: "awaiting_receipt" });
      return `🎉 Acceso activado con tu código promo!\n\n${MESSAGES.askReceipt}`;
    }

    const paymentLink = await createPaymentLink(phone, plan, session.promoCode);

    return `📦 *${priceResult.label}*\n${priceMsg}\n\n👇 Paga aquí:\n${paymentLink.url}\n\n_Después de pagar envíame tu número de recibo USCIS._`;
  }

  // ── Step: Awaiting receipt number ──────────────────────────────────
  if (session.step === "awaiting_receipt") {
    const receiptRegex = /[A-Z]{3}\d{10}/i;
    const match = msg.match(receiptRegex);

    if (!match) {
      return `❌ No reconocí un número de recibo en tu mensaje.\n\nEjemplo: *IOE0931774969*\n\nEscríbelo tal como aparece en tu carta de USCIS.`;
    }

    const receipt = match[0].toUpperCase();
    await sendMessage(phone, `🔍 Buscando caso *${receipt}*...`);

    const result = await fetchUSCISCase(receipt);

    if (result.error) {
      return formatError(result.error, receipt) + MESSAGES.disclaimer;
    }

    // Marcar free query como usada
    if (!session.freeUsed) {
      setSession(phone, { freeUsed: true, step: "post_query" });
    } else {
      setSession(phone, { step: "post_query" });
    }

    const caseMsg = formatCaseMessage(result.data);

    return (
      caseMsg +
      MESSAGES.disclaimer +
      `\n\n_¿Quieres alertas automáticas cuando tu caso se actualice? Responde *alertas*._`
    );
  }

  // ── Post query ─────────────────────────────────────────────────────
  if (session.step === "post_query") {
    if (msg.toLowerCase() === "alertas") {
      setSession(phone, { step: "select_plan" });
      return `🔔 Para activar alertas automáticas selecciona un plan:\n\n${MESSAGES.pricing}`;
    }
    // Check if sending another receipt
    const receiptRegex = /[A-Z]{3}\d{10}/i;
    if (receiptRegex.test(msg)) {
      setSession(phone, { step: "awaiting_receipt" });
      return handleMessage(phone, msg);
    }
  }

  // ── Fallback ───────────────────────────────────────────────────────
  if (msg.toLowerCase() === "menu") {
    setSession(phone, { step: "main_menu" });
    return MESSAGES.welcome;
  }

  return `No entendí tu mensaje. Escribe *menu* para ver las opciones.`;
}

// ─── Vercel Handler ────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Verificación inicial de Meta
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  // Recibir mensajes
  if (req.method === "POST") {
    const body = req.body;

    try {
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (!messages || messages.length === 0) {
        return res.status(200).send("OK");
      }

      const message = messages[0];
      const phone = message.from;
      const text = message.text?.body;

      if (!text) return res.status(200).send("OK");

      const response = await handleMessage(phone, text);
      await sendMessage(phone, response);

      return res.status(200).send("OK");
    } catch (err) {
      console.error("Bot error:", err);
      return res.status(200).send("OK"); // Siempre 200 a Meta
    }
  }

  return res.status(405).send("Method not allowed");
}
