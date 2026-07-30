import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { findPassageForText } from "../_shared/prayer-search-service.ts";
import { YouVersionProvider } from "../_shared/youversion-provider.ts";
import { ApiBibleProvider } from "../_shared/apibible-provider.ts";
import { resolveBibleId } from "../_shared/bible-types.ts";
import type { BibleTranslation } from "../_shared/bible-types.ts";
import {
  BRAND,
  closing,
  commitmentList,
  emailShell,
  greeting,
  leadLine,
  paragraph,
  passageBlock,
  personalRequestBlock,
  praisesBlock,
  prayerRequestsBlock,
  PSALM_INTRO_HTML,
} from "../_shared/email-layout.ts";

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
  end_date: string | null; // YYYY-MM-DD, null = no end
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

interface CategoryMeditation {
  categoryName: string;
  bodies: string[];
}

// ─── Is a rhythm due right now? ───────────────────────────────────────────────
// Called every hour by pg_cron. A rhythm fires when the current local hour
// matches send_time and the day matches the cadence configuration.

function isDue(rhythm: Rhythm, now: Date): boolean {
  if (!rhythm.is_active) return false;

  // Check end_date: stop firing after this date (compared in rhythm's local timezone)
  if (rhythm.end_date) {
    const localDateStr = now.toLocaleDateString("en-CA", { timeZone: rhythm.timezone }); // YYYY-MM-DD
    if (localDateStr > rhythm.end_date) return false;
  }

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

type PassageResult = { reference: string; translation: string; text: string; copyright: string | null };

function buildEmailHtml(
  warrior: Commitment,
  points: PrayerPoint[],
  categoryMeditations: CategoryMeditation[],
  passage: PassageResult | null,
  unsubscribeUrl: string,
): string {
  const openPoints = points.filter((p) => !p.is_answered);

  const categoryNames = categoryMeditations.map((m) => m.categoryName);
  const requestGroups = categoryMeditations.map((m) => ({
    categoryName: m.categoryName,
    requests: m.bodies,
  }));

  const bodyHtml = `
    ${leadLine()}
    ${greeting(warrior.name)}
    ${paragraph(PSALM_INTRO_HTML)}
    ${commitmentList(categoryNames)}
    ${prayerRequestsBlock(requestGroups)}
    ${personalRequestBlock(openPoints.length === 0 ? warrior.prayer_request : "")}
    ${openPoints.length > 0 ? prayerRequestsBlock([{ categoryName: "Your Personal Requests", requests: openPoints.map((p) => p.body) }]) : ""}
    ${passageBlock(passage)}
    ${praisesBlock()}
    ${closing()}
  `;

  return emailShell({
    title: "A Prayer Reminder",
    bodyHtml,
    unsubscribeUrl,
  });
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

  // DECISION: db: { schema: 'prayer_wall' } is required — all tables live in that schema, not public.
  // Omitting this causes all queries to silently target public and return empty results.
  // See docs/decisions/002-prayer-wall-schema.md
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    db: { schema: "prayer_wall" },
  });

  const now = new Date();

  // 1. Load all active rhythms
  const { data: rhythms, error: rhythmErr } = await supabase
    .from("email_rhythms")
    .select("id, cadence, day_of_week, day_of_month, send_time, timezone, is_active, end_date")
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

  // 3. Find which categories are assigned to due rhythms
  const { data: catRhythmRows, error: catRhythmErr } = await supabase
    .from("category_rhythms")
    .select("category_id, rhythm_id")
    .in("rhythm_id", dueRhythmIds);

  if (catRhythmErr) {
    console.error("Failed to load category_rhythms:", catRhythmErr.message);
    return new Response(JSON.stringify({ error: catRhythmErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dueCategoryIds = [...new Set(
    (catRhythmRows ?? []).map((r: { category_id: string; rhythm_id: string }) => r.category_id),
  )];

  if (dueCategoryIds.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, failed: 0, total: 0, message: "No categories assigned to due rhythms" }),
      { headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }

  // 3b. Find all bricklayers who subscribed to any of those categories
  const { data: catCommitments, error: catCommitErr } = await supabase
    .from("commitment_categories")
    .select("commitment_id, category_id")
    .in("category_id", dueCategoryIds);

  if (catCommitErr) {
    console.error("Failed to load commitment_categories:", catCommitErr.message);
    return new Response(JSON.stringify({ error: catCommitErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build a map: commitment_id → Set<category_id> (only categories with a due rhythm)
  const commitmentCategoryMap = new Map<string, Set<string>>();
  for (const row of (catCommitments ?? []) as Array<{ commitment_id: string; category_id: string }>) {
    if (!commitmentCategoryMap.has(row.commitment_id)) {
      commitmentCategoryMap.set(row.commitment_id, new Set());
    }
    commitmentCategoryMap.get(row.commitment_id)!.add(row.category_id);
  }

  const uniqueCommitmentIds = [...commitmentCategoryMap.keys()];

  if (uniqueCommitmentIds.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, failed: 0, total: 0, message: "No bricklayers in categories assigned to due rhythms" }),
      { headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }

  // 3c. Load category names (needed for stacked meditation labels)
  const { data: categoryRows } = await supabase
    .from("message_categories")
    .select("id, name")
    .in("id", dueCategoryIds);

  const categoryNameMap = new Map<string, string>(
    (categoryRows ?? []).map((c: { id: string; name: string }) => [c.id, c.name] as [string, string]),
  );

  // 4a. Load wall theme to get preferred Bible translation
  // We grab one wall_id from the commitments; all bricklayers share the same wall.
  const wallId = Deno.env.get("SUPABASE_WALL_ID") ?? "";
  const { data: themeRow } = await supabase
    .from("wall_theme")
    .select("bible_translation")
    .eq("wall_id", wallId)
    .maybeSingle();
  const preferredTranslation = ((themeRow?.bible_translation as string | undefined) ?? "ESV") as BibleTranslation;

  // Determine provider and bibleId once for all emails in this run
  const youversionKey = Deno.env.get("YOUVERSION_APP_KEY");
  const apiBibleKey   = Deno.env.get("API_BIBLE_KEY");
  const bibleProvider = youversionKey ? new YouVersionProvider() : new ApiBibleProvider();
  const providerName  = youversionKey ? "youversion" : "api.bible" as const;
  const bibleId       = resolveBibleId(preferredTranslation, providerName);
  console.log(`Bible: translation=${preferredTranslation} provider=${providerName} bibleId=${bibleId} apiKey=${apiBibleKey ? "set" : "missing"}`);

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

      // Build stacked meditations: for each category this warrior belongs to that
      // has a due rhythm, pick one active meditation from that category.
      const warriorCategoryIds = [...(commitmentCategoryMap.get(warrior.id) ?? new Set<string>())];
      const categoryMeditations: CategoryMeditation[] = [];
      for (const catId of warriorCategoryIds) {
        const { data: medRows } = await supabase
          .from("prayer_meditations")
          .select("body")
          .eq("category_id", catId)
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        const bodies = (medRows ?? [])
          .map((m: { body: string }) => m.body)
          .filter(Boolean);
        if (bodies.length > 0) {
          categoryMeditations.push({
            categoryName: categoryNameMap.get(catId) ?? "Prayer",
            bodies,
          });
        }
      }

      // Find a relevant Bible passage from warrior's prayer points and request
      const openPoints = (points ?? []).filter((p: PrayerPoint) => !p.is_answered);
      const searchText = [
        ...openPoints.map((p: PrayerPoint) => p.body),
        warrior.prayer_request,
      ].filter(Boolean).join(" ");

      let passage: PassageResult | null = null;
      if (searchText) {
        passage = await findPassageForText(searchText, bibleProvider, bibleId);
      }

      const html = buildEmailHtml(
        warrior as Commitment,
        (points ?? []) as PrayerPoint[],
        categoryMeditations,
        passage,
        unsubscribeUrl,
      );

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${BRAND.fromName} <${fromEmail}>`,
          to: warrior.email,
          subject: "A friendly reminder to pray",
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
