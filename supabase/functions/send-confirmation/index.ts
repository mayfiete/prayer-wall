import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f5f5f4;">
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">

        <div style="background: #9a3412; padding: 28px 32px;">
          <p style="margin:0; font-size: 12px; color: #fca5a5; text-transform: uppercase; letter-spacing: 0.1em;">Prayer Wall · Commitment Confirmed</p>
          <h1 style="margin: 8px 0 0; font-size: 22px; color: #ffffff; font-weight: normal;">Your stone has been placed</h1>
        </div>

        <div style="padding: 32px;">
          <p style="margin: 0 0 16px; font-size: 16px; color: #1c1917;">Hi ${commitment.name},</p>
          <p style="margin: 0 0 16px; font-size: 15px; color: #44403c; line-height: 1.7;">
            Your name has been placed on the prayer wall. Thank you for committing to intercede —
            your prayers matter and heaven hears every one of them.
          </p>
          <p style="margin: 0 0 16px; font-size: 15px; color: #44403c; line-height: 1.7;">
            You will begin receiving prayer reminders on the schedule set by your community.
            A separate email with your full prayer guide is on its way to you now.
          </p>
          <p style="margin: 24px 0 0; font-size: 15px; color: #44403c; line-height: 1.7;">
            Keep pressing in.
          </p>
        </div>

        <div style="padding: 20px 32px; border-top: 1px solid #e7e5e4; background: #fafaf9;">
          <p style="margin: 0; font-size: 12px; color: #a8a29e; line-height: 1.6;">
            You're receiving this because you placed your name on the prayer wall.
            <a href="${unsubscribeUrl}" style="color: #a8a29e;">Unsubscribe</a>
          </p>
        </div>

      </div>
    </body>
    </html>
  `;
}

function buildSummaryHtml(
  commitment: Commitment,
  categories: Category[],
  meditationMap: Map<string, string[]>,
  unsubscribeUrl: string,
): string {
  const hasAnyMeditations = categories.some(
    (c) => (meditationMap.get(c.id) ?? []).length > 0,
  );

  const categorySections = hasAnyMeditations
    ? categories
        .filter((c) => (meditationMap.get(c.id) ?? []).length > 0)
        .map((c, i, arr) => {
          const bodies = meditationMap.get(c.id) ?? [];
          const meditationsHtml = bodies
            .map(
              (body) =>
                `<p style="margin: 0 0 1.2em; font-size: 15px; color: #44403c; line-height: 1.7;">${body}</p>`,
            )
            .join("");
          const divider =
            i < arr.length - 1
              ? `<hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">`
              : "";
          return `
            <div style="margin: 0 0 4px;">
              <p style="margin: 0 0 16px; font-size: 12px; font-weight: bold; color: #9a3412; text-transform: uppercase; letter-spacing: 0.08em;">${c.name}</p>
              ${meditationsHtml}
            </div>
            ${divider}`;
        })
        .join("")
    : `<p style="font-size: 15px; color: #44403c; line-height: 1.7;">
        No meditations are currently available for your selected categories.
        Your community administrator will add content soon.
       </p>`;

  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f5f5f4;">
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">

        <div style="background: #9a3412; padding: 28px 32px;">
          <p style="margin:0; font-size: 12px; color: #fca5a5; text-transform: uppercase; letter-spacing: 0.1em;">Prayer Wall · Your Prayer Guide</p>
          <h1 style="margin: 8px 0 0; font-size: 22px; color: #ffffff; font-weight: normal;">Your prayers &amp; meditations</h1>
        </div>

        <div style="padding: 32px;">
          <p style="margin: 0 0 16px; font-size: 16px; color: #1c1917;">Hi ${commitment.name},</p>
          <p style="margin: 0 0 24px; font-size: 15px; color: #44403c; line-height: 1.7;">
            Here are the prayers and meditations for the categories you selected.
            Use these as a guide during your time of intercession.
          </p>

          ${categorySections}

          <p style="margin: 24px 0 0; font-size: 15px; color: #44403c; line-height: 1.7;">
            Keep pressing in. Heaven hears every prayer.
          </p>
        </div>

        <div style="padding: 20px 32px; border-top: 1px solid #e7e5e4; background: #fafaf9;">
          <p style="margin: 0; font-size: 12px; color: #a8a29e; line-height: 1.6;">
            You're receiving this because you placed your name on the prayer wall.
            <a href="${unsubscribeUrl}" style="color: #a8a29e;">Unsubscribe</a>
          </p>
        </div>

      </div>
    </body>
    </html>
  `;
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

  const fromDisplay = `Prayer Wall <${fromEmail}>`;
  const errors: string[] = [];
  let sent = 0;

  // ── 6. Send Email #1 — Confirmation ───────────────────────────────────────
  const confirmHtml = buildConfirmationHtml(commitment as Commitment, unsubscribeUrl);
  const confirmResult = await sendEmail(
    resendApiKey,
    fromDisplay,
    commitment.email,
    "Your prayer stone has been placed",
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
    "Your prayers & meditations",
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
