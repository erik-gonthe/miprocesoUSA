// lib/promos.js — valida y aplica códigos promocionales

import { PROMO_CODES, PRICES } from "../config/pricing.js";

export function validatePromoCode(code, plan = null) {
  const promo = PROMO_CODES[code?.toUpperCase()];

  if (!promo) {
    return { valid: false, message: "❌ Código no válido. Verifica que esté escrito correctamente." };
  }

  // Verificar expiración
  if (promo.expiresAt && new Date() > new Date(promo.expiresAt)) {
    return { valid: false, message: "❌ Este código ya expiró." };
  }

  // Verificar si aplica al plan seleccionado
  if (plan && promo.plan && promo.plan !== plan) {
    const planName = PRICES[promo.plan]?.label || promo.plan;
    return { valid: false, message: `❌ Este código solo aplica al plan *${planName}*.` };
  }

  return {
    valid: true,
    promo,
    code: code.toUpperCase(),
    message: `✅ *Código aplicado:* ${promo.description}`,
  };
}

export function applyDiscount(plan, promoCode) {
  const price = PRICES[plan];
  if (!price) return null;

  const result = {
    plan,
    label: price.label,
    originalAmount: price.amount,
    finalAmount: price.amount,
    discount: 0,
    isFree: false,
    currency: price.currency,
    type: price.type,
    interval: price.interval || null,
    promoApplied: null,
  };

  if (!promoCode) return result;

  const validation = validatePromoCode(promoCode, plan);
  if (!validation.valid) return result;

  const { promo } = validation;

  // Aplicar descuento
  if (promo.discount === 100 || promo.freeQueries > 0) {
    result.finalAmount = 0;
    result.isFree = true;
  } else {
    result.finalAmount = Math.round(price.amount * (1 - promo.discount / 100));
  }

  result.discount = promo.discount;
  result.promoApplied = promoCode.toUpperCase();

  return result;
}

export function formatPriceMessage(priceResult) {
  const original = (priceResult.originalAmount / 100).toFixed(2);
  const final = (priceResult.finalAmount / 100).toFixed(2);
  const currency = priceResult.currency.toUpperCase();

  if (priceResult.isFree) {
    return `🎉 *¡GRATIS!* ~~$${original} ${currency}~~`;
  }

  if (priceResult.discount > 0) {
    return `💰 *$${final} ${currency}* ~~$${original}~~ (-${priceResult.discount}%)`;
  }

  return `💰 *$${final} ${currency}*`;
}
