// api/stripe-webhook.js
// Escucha pagos completados y activa el acceso del usuario

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    // En producción usa: stripe.webhooks.constructEvent(rawBody, sig, secret)
    event = req.body;
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed" ||
      event.type === "payment_intent.succeeded") {

    const phone = event.data?.object?.metadata?.phone;
    const plan = event.data?.object?.metadata?.plan;

    if (phone && plan) {
      // Aquí activas el plan del usuario
      // En producción: guarda en DB (Supabase/PlanetScale)
      console.log(`✅ Pago recibido — ${phone} activó plan ${plan}`);

      // Notifica al usuario por WhatsApp
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
            to: phone,
            type: "text",
            text: {
              body: `✅ *¡Pago confirmado!*\n\nTu plan está activo. Envíame tu número de recibo USCIS para consultar tu caso.\n\nEjemplo: *IOE0931774969*`,
            },
          }),
        }
      );
    }
  }

  return res.status(200).json({ received: true });
}
