// Stripe webhook — the ONLY thing that may create a donation row.
//
// Deploy with --no-verify-jwt: Stripe cannot present a Supabase JWT, so
// authentication is entirely HMAC signature verification of the raw body.
//
// We listen to checkout.session.completed (not payment_intent.succeeded) because
// the session carries our Full Name metadata, customer_details, and legacy
// custom_fields. See ADR-004 amendment.
//
// Secrets required: STRIPE_WEBHOOK_SECRET, GIVING_WALL_ID,
//                   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (auto-injected)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STRIPE_TOLERANCE_SECONDS = 300;
const UNIQUE_VIOLATION = "23505";

/** Only these create a brick. Everything else is audited and skipped. */
const ACTIONABLE_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

// ─── Signature verification ───────────────────────────────────────────────────

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(
  body: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = signatureHeader.split(",").map((p) => p.trim());
  const timestamp = Number.parseInt(
    parts.find((p) => p.startsWith("t="))?.slice(2) ?? "0",
    10,
  );
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  // Reject replays of old events.
  const ageSeconds = Math.floor(Date.now() / 1000) - timestamp;
  if (Math.abs(ageSeconds) > STRIPE_TOLERANCE_SECONDS) {
    console.warn(`Stripe webhook outside tolerance: ${ageSeconds}s`);
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const computed = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signatures.some((sig) => timingSafeEqual(sig, computed));
}

// ─── Stripe payload shapes (only the fields we read) ──────────────────────────

interface StripeCustomField {
  key: string;
  text?: { value: string | null };
}

interface StripeCheckoutSession {
  id: string;
  livemode: boolean;
  payment_intent: string | null;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  customer_details: {
    name: string | null;
    // Newer first-class name fields; present on recent API versions only.
    individual_name?: string | null;
    business_name?: string | null;
    email: string | null;
  } | null;
  custom_fields?: StripeCustomField[];
  metadata?: Record<string, string>;
}

interface StripeEvent {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: StripeCheckoutSession };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Brick label priority: the donor's optional "Name on the wall" override, then
 * the name Stripe collected with the billing address, then Anonymous.
 */
function resolveBrickName(session: StripeCheckoutSession): string {
  if (session.metadata?.is_anonymous === "true") return "Anonymous";

  const fullName = session.metadata?.full_name?.trim();
  if (fullName) return fullName.slice(0, 100);

  const override = session.custom_fields
    ?.find((f) => f.key === "wallname" || f.key === "wall_name")
    ?.text?.value
    ?.trim();
  if (override) return override.slice(0, 100);

  // Older Checkout Sessions may still carry the former separate name fields.
  const firstName = session.custom_fields?.find((f) => f.key === "firstname" || f.key === "first_name")?.text?.value?.trim();
  const lastName = session.custom_fields?.find((f) => f.key === "lastname" || f.key === "last_name")?.text?.value?.trim();
  const capturedName = [firstName, lastName].filter(Boolean).join(" ");
  if (capturedName) return capturedName.slice(0, 100);

  const details = session.customer_details;
  const payerName = details?.individual_name?.trim() ||
    details?.name?.trim() ||
    details?.business_name?.trim();
  if (payerName) return payerName.slice(0, 100);

  return "Anonymous";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Raw text — reserialising the JSON would break the HMAC.
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("stripe-signature") ?? "";

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeMode = Deno.env.get("STRIPE_MODE") ?? "test";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const givingWallId = Deno.env.get("GIVING_WALL_ID");

  if (!webhookSecret || !givingWallId) {
    console.error("Missing STRIPE_WEBHOOK_SECRET or GIVING_WALL_ID secret");
    return json({ error: "Webhook not configured" }, 500);
  }

  if (stripeMode !== "test" && stripeMode !== "live") {
    console.error("STRIPE_MODE must be test or live");
    return json({ error: "Webhook payment mode is not configured correctly" }, 500);
  }

  if (!await verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) {
    // Never audit an unverified payload — we can't trust anything in it.
    console.warn("giving-wall-webhook: invalid signature");
    return json({ error: "Invalid signature" }, 401);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const expectedLiveMode = stripeMode === "live";
  if (event?.livemode !== expectedLiveMode ||
    (ACTIONABLE_EVENTS.has(event.type) && event.data?.object?.livemode !== expectedLiveMode)) {
    console.warn("giving-wall-webhook: event does not match STRIPE_MODE");
    return json({ error: "Webhook payment mode does not match this deployment" }, 400);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "prayer_wall" } });

  const markAudit = async (status: string, fields: Record<string, unknown> = {}) => {
    const { error } = await db.from("webhook_events")
      .update({ status, processed_at: new Date().toISOString(), error_message: null, ...fields })
      .eq("processor_event_id", event.id);
    if (error) console.error("Failed to update webhook audit:", error.message);
    return !error;
  };

  // ── Audit first, always — even for events we ignore ────────────────────────
  const { error: auditError } = await db.from("webhook_events").insert({
    giving_wall_id: givingWallId,
    processor: "stripe",
    event_type: event.type,
    processor_event_id: event.id,
    raw_payload: event as unknown as Record<string, unknown>,
    status: "pending",
  });

  if (auditError && auditError.code !== UNIQUE_VIOLATION) {
    console.error("Failed to write webhook_events row:", auditError.message);
    return json({ error: "Audit log failure" }, 500);
  }

  if (!ACTIONABLE_EVENTS.has(event.type)) {
    await markAudit("skipped");
    return json({ received: true, skipped: "not_actionable" }, 200);
  }

  const session = event.data?.object;
  if (!session?.id) {
    await markAudit("failed", { error_message: "Missing data.object" });
    return json({ error: "Malformed event" }, 400);
  }

  if (session.payment_status !== "paid") {
    // e.g. a delayed payment method that hasn't cleared — no brick yet.
    await markAudit("skipped", { error_message: `payment_status=${session.payment_status}` });
    return json({ received: true, skipped: "not_paid" }, 200);
  }

  if (session.metadata?.giving_wall_id !== givingWallId) {
    await markAudit("failed", { error_message: "Missing or mismatched giving_wall_id metadata" });
    return json({ error: "Checkout does not belong to this giving wall" }, 400);
  }

  const amountCents = session.amount_total;
  if (!Number.isSafeInteger(amountCents) || amountCents === null || amountCents <= 0 ||
    typeof session.currency !== "string" || !/^[a-z]{3}$/.test(session.currency)) {
    await markAudit("failed", { error_message: "Invalid paid amount or currency" });
    return json({ error: "Malformed paid checkout" }, 400);
  }

  const processorRef = session.payment_intent ?? session.id;

  // ── Idempotency at the donation level ─────────────────────────────────────
  const { data: donation, error: donationError } = await db.rpc("record_paid_donation", {
    p_wall_id: givingWallId,
    p_processor_ref: processorRef,
    p_name: resolveBrickName(session),
    p_email: session.customer_details?.email ?? null,
    p_amount_cents: amountCents,
    p_currency: session.currency,
  });

  if (donationError || !donation?.id || !donation?.commitment_id) {
    const message = donationError?.message ?? "Missing donation or commitment result";
    console.error("Failed to record donation and commitment:", message);
    await markAudit("failed", { error_message: message });
    // 500 makes Stripe retry, which is what we want for a transient DB failure.
    return json({ error: "Donation persistence failed" }, 500);
  }

  if (!await markAudit("processed", { donation_id: donation.id })) {
    return json({ error: "Audit update failed" }, 500);
  }

  if (!donation.created) {
    // Stripe delivers at least once; we've already handled this event.
    console.log(`Donation for ${processorRef} already recorded — idempotent skip`);
    return json({ received: true, donation_id: donation.id, commitment_id: donation.commitment_id, skipped: "already_recorded" }, 200);
  }

  // Fire-and-forget: the webhook must answer Stripe quickly, and a failed email
  // leaves thank_you_sent = false so it can be retried.
  const sendThanks = db.functions
    .invoke("send-donation-thanks", { body: { donation_id: donation.id } })
    .then(({ error }: { error: unknown }) => {
      if (error) console.error("[send-donation-thanks] invoke failed:", error);
    })
    .catch((err: unknown) => console.error("[send-donation-thanks] invoke failed:", err));
  EdgeRuntime.waitUntil(sendThanks);

  console.log(
    `giving-wall-webhook: processed ${event.type} session=${session.id} ` +
      `donation=${donation.id} amount=${amountCents}${session.currency}`,
  );

  return json({ received: true, donation_id: donation.id, commitment_id: donation.commitment_id }, 200);
});
