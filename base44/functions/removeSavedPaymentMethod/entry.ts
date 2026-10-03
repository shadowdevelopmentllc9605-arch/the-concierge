import { createClientFromRequest } from "npm:@base44/sdk";
import Stripe from "npm:stripe@23.0.0";
import { secrets } from "base44:runtime";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { paymentMethodId } = await req.json();
    const rows = await base44.asServiceRole.entities.PaymentMethod.filter({
      id: paymentMethodId,
      user_id: user.id,
    });
    const record = rows[0];
    if (!record) return Response.json({ error: "Payment method not found" }, { status: 404 });

    if (record.processor === "stripe" && record.processor_payment_method_id) {
      const stripeSecret = secrets.get("STRIPE_SECRET_KEY");
      if (!stripeSecret) {
        return Response.json({
          error: "Stripe is not configured, so this saved payment method cannot be detached safely.",
        }, { status: 409 });
      }
      const stripe = new Stripe(stripeSecret);
      try {
        await stripe.paymentMethods.detach(record.processor_payment_method_id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!message.toLowerCase().includes("not attached")) throw error;
      }
    }

    await base44.asServiceRole.entities.PaymentMethod.delete(record.id);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Payment method could not be removed.",
    }, { status: 500 });
  }
}
