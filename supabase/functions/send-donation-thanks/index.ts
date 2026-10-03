// Sends the thank-you email for a confirmed donation and records it in
// email_logs. Invoked (fire-and-forget) by giving-wall-webhook with a
// service_role JWT, so verify_jwt can stay on.
//
// Secrets required: RESEND_API_KEY, FROM_EMAIL, APP_URL,
//                   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (auto-injected)
// (APP_URL is no longer used here — opt-out is by replying to the Reply-To address.)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  closing,
  emailShell,
  fromHeader,
  greeting,
  mergeEmailCopy,
  renderParagraphs,
  replyToAddress,
} from "../_shared/email-layout.ts";
import type { EmailCopyRow } from "../_shared/email-copy.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  let donationId: string;
  try {
    const body = await req.json() as { donation_id?: unknown };
    if (typeof body.donation_id !== "string" || !UUID_RE.test(body.donation_id)) {
      return json({ error: "donation_id must be a valid UUID" }, 400);
    }
    donationId = body.donation_id;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const db = supabase.schema("prayer_wall");

  const { data: donation, error: fetchError } = await db
    .from("donations")
    .select("id, giving_wall_id, name, amount_cents, currency, email, thank_you_sent")
    .eq("id", donationId)
    .maybeSingle();

  if (fetchError) {
    console.error("DB error fetching donation:", fetchError.message);
    return json({ error: "Database error" }, 500);
  }
  if (!donation) return json({ error: "Donation not found" }, 404);

  if (donation.thank_you_sent) {
    return json({ skipped: "already_sent" }, 200);
  }

  // Nothing to send to — flag it so the webhook never retries this donation.
  if (!donation.email) {
    await db.from("donations").update({ thank_you_sent: true }).eq("id", donationId);
    return json({ skipped: "no_email" }, 200);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const fromEmail = Deno.env.get("FROM_EMAIL") ?? "noreply@prayerrhythm.com";

  const amountFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: donation.currency.toUpperCase(),
  }).format(donation.amount_cents / 100);

  const { data: copyRows, error: copyErr } = await db
    .from("email_copy")
    .select("copy_key, value")
    .eq("wall_id", donation.giving_wall_id);

  if (copyErr) {
    // Wording is not worth failing a receipt over — fall back to defaults.
    console.error("DB error fetching email_copy:", copyErr.message);
  }

  const copy = mergeEmailCopy((copyRows ?? []) as EmailCopyRow[]);

  const bodyHtml = `
    ${greeting(copy, donation.name)}
    ${renderParagraphs(copy.donation_body, { amount: amountFormatted })}
    ${closing(copy)}
  `;

  const html = emailShell({
    copy,
    title: copy.donation_title,
    bodyHtml,
    eyebrow: copy.donation_eyebrow,
    footerText: copy.donation_footer_text,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromHeader(copy, fromEmail),
      reply_to: replyToAddress(copy),
      to: [donation.email],
      subject: copy.donation_subject,
      html,
      tags: [{ name: "type", value: "donation_thank_you" }],
    }),
  });

  const resendData = await res.json() as { id?: string; message?: string };

  await db.from("email_logs").insert({
    giving_wall_id: donation.giving_wall_id,
    donation_id: donation.id,
    email: donation.email,
    status: res.ok ? "sent" : "failed",
    email_type: "donation_thank_you",
    resend_message_id: resendData.id ?? null,
  });

  // Only flag as sent on success so a transient Resend failure can be retried.
  if (res.ok) {
    await db.from("donations").update({ thank_you_sent: true }).eq("id", donationId);
  } else {
    console.error("Resend donation thank-you error:", resendData.message ?? `HTTP ${res.status}`);
  }

  console.log(`send-donation-thanks: donation=${donationId} sent=${res.ok}`);

  return json({ sent: res.ok }, res.ok ? 200 : 502);
});
