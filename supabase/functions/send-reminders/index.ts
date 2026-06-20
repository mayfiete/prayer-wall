import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Cadence = "daily" | "weekly" | "monthly";

interface Rhythm {
  id: string;
  cadence: Cadence;
  day_of_week: number | null;
  day_of_month: number | null;
  send_time: string; // "HH:MM"
  timezone: string;
  is_active: boolean;
}

interface Commitment {
  id: string;
  wall_id: string;
  name: string;
  email: string;
  prayer_request: string;
}

interface PrayerPoint {
  body: string;
  is_answered: boolean;
}

// ─── Is a rhythm due right now? ───────────────────────────────────────────────
// Called every hour by pg_cron. A rhythm fires when the current local hour
// matches send_time and the day matches the cadence configuration.

function isDue(rhythm: Rhythm, now: Date): boolean {
  if (!rhythm.is_active) return false;

  // Convert UTC now to rhythm's local time
  const localStr = now.toLocaleString("en-US", { timeZone: rhythm.timezone });
  const local = new Date(localStr);

  const localHour = local.getHours();
  const [sendHour] = rhythm.send_time.split(":").map(Number);

  if (localHour !== sendHour) return false;

  if (rhythm.cadence === "daily") return true;

  if (rhythm.cadence === "weekly") {
    return local.getDay() === (rhythm.day_of_week ?? 0);
  }

  if (rhythm.cadence === "monthly") {
    return local.getDate() === (rhythm.day_of_month ?? 1);
  }

  return false;
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

function buildEmailHtml(
  warrior: Commitment,
  points: PrayerPoint[],
  unsubscribeUrl: string,
): string {
  const openPoints = points.filter((p) => !p.is_answered);
  const pointsHtml = openPoints.length > 0
    ? `
      <div style="margin: 24px 0; padding: 16px 20px; background: #fdf8f5; border-left: 3px solid #9a3412; border-radius: 4px;">
        <p style="margin: 0 0 12px; font-size: 13px; font-weight: bold; color: #78350f; text-transform: uppercase; letter-spacing: 0.05em;">Prayer Points</p>
        <ul style="margin: 0; padding-left: 20px; color: #44403c; font-size: 15px; line-height: 1.7;">
          ${openPoints.map((p) => `<li>${p.body}</li>`).join("")}
        </ul>
      </div>`
    : warrior.prayer_request
    ? `
      <div style="margin: 24px 0; padding: 16px 20px; background: #fdf8f5; border-left: 3px solid #9a3412; border-radius: 4px;">
        <p style="margin: 0; color: #44403c; font-size: 15px; line-height: 1.7;">${warrior.prayer_request}</p>
      </div>`
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f5f5f4;">
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">

        <div style="background: #9a3412; padding: 28px 32px;">
          <p style="margin:0; font-size: 12px; color: #fca5a5; text-transform: uppercase; letter-spacing: 0.1em;">Prayer Rhythms · Prayer Wall</p>
          <h1 style="margin: 8px 0 0; font-size: 22px; color: #ffffff; font-weight: normal;">Your Prayer Reminder</h1>
        </div>

        <div style="padding: 32px;">
          <p style="margin: 0 0 16px; font-size: 16px; color: #1c1917;">Hi ${warrior.name},</p>
          <p style="margin: 0 0 16px; font-size: 15px; color: #44403c; line-height: 1.7;">
            This is your scheduled reminder to spend time in prayer.
            Thank you for your commitment to intercede — your prayers matter.
          </p>

          ${pointsHtml}

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

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // Auth: require CRON_SECRET header (set as Supabase secret, passed by pg_cron)
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey   = Deno.env.get("RESEND_API_KEY")!;
  const fromEmail      = Deno.env.get("FROM_EMAIL") ?? "noreply@yourdomain.com";
  const appUrl         = Deno.env.get("APP_URL") ?? "https://your-app.com";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    db: { schema: "prayer_wall" },
  });

  const now = new Date();

  // 1. Load all active rhythms
  const { data: rhythms, error: rhythmErr } = await supabase
    .from("email_rhythms")
    .select("id, cadence, day_of_week, day_of_month, send_time, timezone, is_active")
    .eq("is_active", true);

  if (rhythmErr) {
    console.error("Failed to load rhythms:", rhythmErr.message);
    return new Response(JSON.stringify({ error: rhythmErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Filter to rhythms that are due right now
  const dueRhythms = (rhythms ?? []).filter((r) => isDue(r as Rhythm, now));

  if (dueRhythms.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, failed: 0, total: 0, message: "No rhythms due" }),
      { headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }

  const dueRhythmIds = dueRhythms.map((r) => r.id);

  // 3. Find all bricklayers assigned to a due rhythm
  const { data: assignments, error: assignErr } = await supabase
    .from("commitment_rhythms")
    .select("commitment_id")
    .in("rhythm_id", dueRhythmIds);

  if (assignErr) {
    console.error("Failed to load assignments:", assignErr.message);
    return new Response(JSON.stringify({ error: assignErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Deduplicate: a bricklayer may be on multiple due rhythms but only gets one email
  const uniqueCommitmentIds = [...new Set(
    (assignments ?? []).map((a: { commitment_id: string }) => a.commitment_id),
  )];

  if (uniqueCommitmentIds.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, failed: 0, total: 0, message: "No bricklayers assigned to due rhythms" }),
      { headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }

  // 4. Load bricklayer details
  const { data: warriors, error: warriorErr } = await supabase
    .from("commitments")
    .select("id, wall_id, name, email, prayer_request")
    .in("id", uniqueCommitmentIds)
    .eq("reminder_active", true);

  if (warriorErr) {
    console.error("Failed to load bricklayers:", warriorErr.message);
    return new Response(JSON.stringify({ error: warriorErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 5. Send emails
  const results = await Promise.allSettled(
    (warriors ?? []).map(async (warrior) => {
      // Load their open prayer points
      const { data: points } = await supabase
        .from("prayer_points")
        .select("body, is_answered")
        .eq("commitment_id", warrior.id)
        .order("display_order", { ascending: true });

      const unsubscribeUrl = `${appUrl}/unsubscribe?id=${warrior.id}`;
      const html = buildEmailHtml(
        warrior as Commitment,
        (points ?? []) as PrayerPoint[],
        unsubscribeUrl,
      );

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `Prayer Wall <${fromEmail}>`,
          to: warrior.email,
          subject: "Your prayer reminder",
          html,
        }),
      });

      const resendData = await res.json() as { id?: string; message?: string };
      const status = res.ok ? "sent" : "failed";

      await supabase.from("email_logs").insert({
        wall_id: warrior.wall_id,
        commitment_id: warrior.id,
        email: warrior.email,
        status,
        resend_message_id: resendData.id ?? null,
      });

      if (!res.ok) {
        throw new Error(`Resend error for ${warrior.email}: ${res.status} ${resendData.message ?? ""}`);
      }

      return warrior.id;
    }),
  );

  // 6. Update last_reminded_at for successful sends
  const sentIds = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value);

  if (sentIds.length > 0) {
    await supabase
      .from("commitments")
      .update({ last_reminded_at: now.toISOString() })
      .in("id", sentIds);
  }

  const sent   = sentIds.length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`send-reminders: ${sent} sent, ${failed} failed of ${warriors?.length ?? 0} bricklayers due`);

  return new Response(
    JSON.stringify({ sent, failed, total: warriors?.length ?? 0 }),
    { headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
  );
});
