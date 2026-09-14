// Creates a Stripe-hosted Checkout Session for a giving wall donation.
//
// Called from the browser (anon key satisfies verify_jwt). The Stripe secret key
// never leaves this function, and no card data ever touches our app — the donor
// enters it on stripe.com, which keeps us in PCI SAQ A scope.
//
// The optional Full Name comes from our form and travels in session metadata.
// Stripe collects billing details; its billing name is the fallback when blank.
// The donation row is created later by giving-wall-webhook, never here.
//
// Secrets required: STRIPE_SECRET_KEY, GIVING_WALL_ID, APP_URL, ORG_NAME (optional)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

const JSON_HEADERS = { "Content-Type": "application/json", ...CORS_HEADERS };

const MIN_AMOUNT_CENTS = 100;
const MAX_AMOUNT_CENTS = 5_000_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CheckoutRequestBody {
  giving_wall_id?: unknown;
  amount_cents?: unknown;
  currency?: unknown;
  is_anonymous?: unknown;
  full_name?: unknown;
  success_url?: unknown;
  cancel_url?: unknown;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * Only accept a client-supplied return URL when it shares an origin with
 * APP_URL — otherwise an attacker could point our Checkout Sessions at their
 * own site and harvest donors mid-flow.
 */
function safeReturnUrl(candidate: unknown, appUrl: string, fallbackPath: string): string {
  const fallback = `${appUrl.replace(/\/$/, "")}${fallbackPath}`;
  if (typeof candidate !== "string") return fallback;
  try {
    if (new URL(candidate).origin === new URL(appUrl).origin) return candidate;
  } catch {
    // fall through to the safe default
  }
  return fallback;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeMode = Deno.env.get("STRIPE_MODE") ?? "test";
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const givingWallId = Deno.env.get("GIVING_WALL_ID");
  const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";
  const orgName = Deno.env.get("ORG_NAME") ?? "Heritage Christian Academy";

  if (!stripeSecretKey || !givingWallId) {
    console.error("Missing STRIPE_SECRET_KEY or GIVING_WALL_ID secret");
    return json({ error: "Payments are not configured yet" }, 500);
  }

  if (stripeMode !== "test" && stripeMode !== "live") {
    console.error("STRIPE_MODE must be test or live");
    return json({ error: "Payment mode is not configured correctly" }, 500);
  }

  const keyMode = /^(?:sk|rk)_(test|live)_.+$/.exec(stripeSecretKey)?.[1];
  if (keyMode !== stripeMode) {
    console.error("STRIPE_SECRET_KEY does not match STRIPE_MODE");
    return json({ error: `Checkout is configured for ${stripeMode} payments, but the Stripe secret key does not match. Contact the site administrator.` }, 500);
  }

  let body: CheckoutRequestBody;
  try {
    body = await req.json() as CheckoutRequestBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // The wall is pinned by secret, so a caller can't place bricks on another wall.
  if (typeof body.giving_wall_id === "string" && body.giving_wall_id !== givingWallId) {
    return json({ error: "Unknown giving wall" }, 400);
  }
  if (!UUID_RE.test(givingWallId)) {
    console.error("GIVING_WALL_ID secret is not a UUID");
    return json({ error: "Payments are not configured yet" }, 500);
  }

  const amountCents = Number(body.amount_cents);
  if (!Number.isInteger(amountCents) || amountCents < MIN_AMOUNT_CENTS || amountCents > MAX_AMOUNT_CENTS) {
    return json({ error: `amount_cents must be a whole number between ${MIN_AMOUNT_CENTS} and ${MAX_AMOUNT_CENTS}` }, 400);
  }

  const currency = typeof body.currency === "string" && /^[a-z]{3}$/i.test(body.currency)
    ? body.currency.toLowerCase()
    : "usd";
  const isAnonymous = body.is_anonymous === true;
  if (body.full_name !== undefined && typeof body.full_name !== "string") {
    return json({ error: "Full Name must be text" }, 400);
  }
  const fullName = isAnonymous ? "" : (body.full_name as string | undefined)?.trim() ?? "";
  if (fullName.length > 100) {
    return json({ error: "Full Name must be 100 characters or fewer" }, 400);
  }

  const successUrl = safeReturnUrl(body.success_url, appUrl, "/giving?checkout=success");
  const cancelUrl = safeReturnUrl(body.cancel_url, appUrl, "/giving?checkout=cancelled");

  // Stripe's API is form-encoded, so nested params use bracket notation.
  const params = new URLSearchParams({
    "mode": "payment",
    "submit_type": "donate",
    "billing_address_collection": "required",
    "success_url": successUrl,
    "cancel_url": cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": currency,
    "line_items[0][price_data][unit_amount]": String(amountCents),
    "line_items[0][price_data][product_data][name]": `Gift to ${orgName}`,
    "line_items[0][price_data][product_data][description]": "Your name is added to the giving wall",
    "metadata[giving_wall_id]": givingWallId,
    "metadata[is_anonymous]": String(isAnonymous),
    "payment_intent_data[metadata][giving_wall_id]": givingWallId,
  });

  if (fullName) params.set("metadata[full_name]", fullName);

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const session = await stripeRes.json() as {
    id?: string;
    url?: string;
    livemode?: boolean;
    error?: { message?: string; type?: string };
  };

  if (!stripeRes.ok || !session.url || !session.id) {
    console.error("Stripe session creation failed:", session.error?.message ?? `HTTP ${stripeRes.status}`);
    return json({ error: "Could not start checkout. Please try again." }, 502);
  }

  if (session.livemode !== (stripeMode === "live")) {
    console.error("Stripe checkout session does not match STRIPE_MODE");
    return json({ error: "The payment processor returned an unexpected payment mode. Checkout was blocked." }, 502);
  }

  console.log(
    `create-donation-checkout: session=${session.id} amount=${amountCents}${currency} anonymous=${isAnonymous}`,
  );

  return json({ url: session.url, session_id: session.id }, 200);
});
