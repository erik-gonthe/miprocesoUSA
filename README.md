# 🤖 USCIS Bot — WhatsApp

Bot de WhatsApp para consultar casos USCIS con pagos integrados y códigos promocionales.

---

## Estructura del proyecto

```
/
├── api/
│   ├── whatsapp.js        ← Webhook principal del bot
│   └── stripe-webhook.js  ← Confirma pagos y activa acceso
├── lib/
│   ├── uscis.js           ← Consulta API de USCIS
│   └── promos.js          ← Valida y aplica códigos promo
├── config/
│   └── pricing.js         ← ⭐ AQUÍ editas precios y promo codes
└── .env.example           ← Variables de entorno necesarias
```

---

## Setup paso a paso

### 1. Meta / WhatsApp Business API
1. Ve a developers.facebook.com → Crear app → Business
2. Agrega producto "WhatsApp"
3. Copia el **Phone Number ID** y el **Access Token**
4. Configura webhook → URL: `https://tu-app.vercel.app/api/whatsapp`
5. Verify Token: cualquier string secreto (el mismo que en .env)
6. Suscríbete al evento `messages`

### 2. Stripe
1. Ve a dashboard.stripe.com → Crear cuenta
2. Copia la **Secret Key** (sk_live_ o sk_test_)
3. En Webhooks → agregar endpoint: `https://tu-app.vercel.app/api/stripe-webhook`
4. Eventos a escuchar: `checkout.session.completed`, `payment_intent.succeeded`
5. Copia el **Webhook Secret** (whsec_...)

### 3. Deploy en Vercel
```bash
# Instala Vercel CLI
npm i -g vercel

# Deploy
vercel

# Configura variables de entorno en vercel.com → Project → Settings → Environment Variables
```

### 4. Variables de entorno en Vercel
Agrega estas variables en Vercel Dashboard:
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_URL`

---

## Cómo editar precios y promo codes

Todo está en `config/pricing.js`:

```js
// Cambiar precio mensual a $3.99
monthly: {
  amount: 399,   // siempre en centavos
  ...
}

// Agregar nuevo código promo
INFLUENCER20: {
  discount: 20,
  freeQueries: 0,
  plan: null,       // null = aplica a todos los planes
  maxUses: 100,
  expiresAt: "2025-06-30",
  description: "20% off para seguidores",
}
```

---

## Flujo del usuario

```
Usuario: "Hola"
Bot: Menú principal (consultar / precios / promo)

Usuario: "1" (consultar)
Bot: "Primera consulta gratis — manda tu receipt number"

Usuario: "IOE0931774969"
Bot: Estatus completo del caso

Bot: "¿Quieres alertas automáticas? — responde 'alertas'"

Usuario: "alertas"
Bot: Menú de planes con precios

Usuario: "2" (mensual $4.99)
Bot: Link de pago Stripe

[Usuario paga]
Stripe → Webhook → Bot notifica: "¡Pago confirmado!"
```

---

## Próximos pasos recomendados

- [ ] Reemplazar `sessions` in-memory con Redis o Supabase
- [ ] Agregar alertas automáticas (cron job que checa casos cada hora)
- [ ] Integrar Mercado Pago para usuarios de Latinoamérica
- [ ] Panel de admin para ver suscriptores y revenue
