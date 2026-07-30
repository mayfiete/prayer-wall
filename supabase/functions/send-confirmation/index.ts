import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  BRAND,
  closing,
  commitmentList,
  emailShell,
  greeting,
  leadLine,
  paragraph,
  praisesBlock,
  prayerRequestsBlock,
  PSALM_INTRO_HTML,
} from "../_shared/email-layout.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

// ─── UUID validation ──────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Commitment {
  id: string;
  wall_id: string;
  name: string;
  email: string;
}

interface Category {
  id: string;
  name: string;
  display_order: number;
}

interface MeditationRow {
  category_id: string;
  body: string;
  display_order: number;
}

// ─── Email HTML builders ──────────────────────────────────────────────────────

function buildConfirmationHtml(commitment: Commitment, unsubscribeUrl: string): string {
  const bodyHtml = `
    ${leadLine()}
    ${greeting(commitment.name)}
    ${paragraph(PSALM_INTRO_HTML)}
    ${paragraph(
      "Your commitment to pray with the " + BRAND.org + " " + BRAND.product +
      " has been received. You'll begin receiving prayer reminders on the schedule set by our team, " +
      "and a separate email with your full prayer guide is on its way to you now.",
    )}
    ${closing()}
  `;

  return emailShell({
    title: "Welcome to the Prayer Foundation",
    bodyHtml,
    unsubscribeUrl,
  });
}

function buildSummaryHtml(
  commitment: Commitment,
  categories: Category[],
  meditationMap: Map<string, string[]>,
  unsubscribeUrl: string,
): string {
  const filledCategories = categories.filter(
    (c) => (meditationMap.get(c.id) ?? []).length > 0,
  );

  const requestGroups = filledCategories.map((c) => ({
    categoryName: c.name,
    requests: meditationMap.get(c.id) ?? [],
  }));

  const requestsHtml = requestGroups.length > 0
    ? commitmentList(filledCategories.map((c) => c.name)) + prayerRequestsBlock(requestGroups)
    : paragraph(
        "No prayer requests are available for your selected categories yet. " +
        "Our team will add content soon.",
      );

  const bodyHtml = `
    ${leadLine()}
    ${greeting(commitment.name)}
    ${paragraph(PSALM_INTRO_HTML)}
    ${requestsHtml}
    ${praisesBlock()}
    ${closing()}
  `;

  return emailShell({
    title: "Your Prayer Guide",
    bodyHtml,
    unsubscribeUrl,
  });
}

// ─── Send one email via Resend ─────────────────────────────────────────────────

async function sendEmail(
  resendApiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  tag: string,
): Promise<{ id: string | null; ok: boolean; message: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      tags: [{ name: "type", value: tag }],
    }),
  });

  const data = await res.json() as { id?: string; message?: string; name?: string };

  return {
    id: data.id ?? null,
    ok: res.ok,
    message: data.message ?? (res.ok ? "sent" : `HTTP ${res.status}`),
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // ── 1. Parse & validate input ──────────────────────────────────────────────
  let commitmentId: string;
  try {
    const body = await req.json() as { commitment_id?: unknown };
    if (!isUuid(body.commitment_id)) {
      return new Response(
        JSON.stringify({ error: "commitment_id must be a valid UUID" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
      );
    }
    commitmentId = body.commitment_id;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }

  // ── 2. Environment ─────────────────────────────────────────────────────────
  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey   = Deno.env.get("RESEND_API_KEY")!;
  const fromEmail      = Deno.env.get("FROM_EMAIL") ?? "noreply@yourdomain.com";
  const appUrl         = Deno.env.get("APP_URL") ?? "https://your-app.com";

  console.log("DEBUG supabaseUrl:", supabaseUrl ? supabaseUrl.slice(0, 30) : "MISSING");
  console.log("DEBUG serviceRoleKey present:", !!serviceRoleKey, "length:", serviceRoleKey?.length ?? 0);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const db = supabase.schema("prayer_wall");

  const unsubscribeUrl = `${appUrl}/unsubscribe?id=${commitmentId}`;

  // ── 3. Fetch commitment ────────────────────────────────────────────────────
  const { data: commitment, error: commitmentErr } = await db
    .from("commitments")
    .select("id, wall_id, name, email")
    .eq("id", commitmentId)
    .maybeSingle();

  if (commitmentErr) {
    console.error("DB error fetching commitment:", commitmentErr.message);
    return new Response(
      JSON.stringify({ error: "Database error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }

  if (!commitment) {
    return new Response(
      JSON.stringify({ error: "Commitment not found" }),
      { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }

  // ── 4. Fetch categories for this commitment ────────────────────────────────
  const { data: ccRows, error: ccErr } = await db
    .from("commitment_categories")
    .select("category_id")
    .eq("commitment_id", commitmentId);

  if (ccErr) {
    console.error("DB error fetching commitment_categories:", ccErr.message);
    return new Response(
      JSON.stringify({ error: "Database error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }

  const categoryIds = (ccRows ?? []).map((r: { category_id: string }) => r.category_id);

  let categories: Category[] = [];
  if (categoryIds.length > 0) {
    const { data: catRows, error: catErr } = await db
      .from("message_categories")
      .select("id, name, display_order")
      .in("id", categoryIds)
      .order("display_order", { ascending: true });

    if (catErr) {
      console.error("DB error fetching message_categories:", catErr.message);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
      );
    }

    categories = (catRows ?? []) as Category[];
  }

  // ── 5. Fetch all active meditations for those categories (single query) ────
  const meditationMap = new Map<string, string[]>();
  if (categoryIds.length > 0) {
    const { data: medRows, error: medErr } = await db
      .from("prayer_meditations")
      .select("category_id, body, display_order")
      .in("category_id", categoryIds)
      .eq("is_active", true)
      .order("category_id", { ascending: true })
      .order("display_order", { ascending: true });

    if (medErr) {
      console.error("DB error fetching prayer_meditations:", medErr.message);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
      );
    }

    for (const row of (medRows ?? []) as MeditationRow[]) {
      if (!meditationMap.has(row.category_id)) {
        meditationMap.set(row.category_id, []);
      }
      meditationMap.get(row.category_id)!.push(row.body);
    }
  }

  const fromDisplay = `${BRAND.fromName} <${fromEmail}>`;
  const errors: string[] = [];
  let sent = 0;

  // ── 6. Send Email #1 — Confirmation ───────────────────────────────────────
  const confirmHtml = buildConfirmationHtml(commitment as Commitment, unsubscribeUrl);
  const confirmResult = await sendEmail(
    resendApiKey,
    fromDisplay,
    commitment.email,
    "Welcome to the Prayer Foundation",
    confirmHtml,
    "confirmation",
  );

  await db.from("email_logs").insert({
    wall_id: commitment.wall_id,
    commitment_id: commitment.id,
    email: commitment.email,
    status: confirmResult.ok ? "sent" : "failed",
    email_type: "confirmation",
    resend_message_id: confirmResult.id,
  });

  if (confirmResult.ok) {
    sent++;
  } else {
    errors.push(`Confirmation email failed: ${confirmResult.message}`);
    console.error("Resend confirmation error:", confirmResult.message);
  }

  // ── 7. Send Email #2 — Prayer & Meditation Summary ────────────────────────
  const summaryHtml = buildSummaryHtml(
    commitment as Commitment,
    categories,
    meditationMap,
    unsubscribeUrl,
  );
  const summaryResult = await sendEmail(
    resendApiKey,
    fromDisplay,
    commitment.email,
    "Your Prayer Guide",
    summaryHtml,
    "summary",
  );

  await db.from("email_logs").insert({
    wall_id: commitment.wall_id,
    commitment_id: commitment.id,
    email: commitment.email,
    status: summaryResult.ok ? "sent" : "failed",
    email_type: "summary",
    resend_message_id: summaryResult.id,
  });

  if (summaryResult.ok) {
    sent++;
  } else {
    errors.push(`Summary email failed: ${summaryResult.message}`);
    console.error("Resend summary error:", summaryResult.message);
  }

  // ── 8. Return result ───────────────────────────────────────────────────────
  const failed = 2 - sent;
  console.log(
    `send-confirmation: commitment=${commitmentId} sent=${sent} failed=${failed}`,
  );

  return new Response(
    JSON.stringify({ sent, failed, ...(errors.length > 0 ? { errors } : {}) }),
    { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
  );
});
