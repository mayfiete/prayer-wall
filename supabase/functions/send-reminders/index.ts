import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const appUrl = Deno.env.get("APP_URL") ?? "https://your-app.pages.dev";

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: commitments, error } = await supabase
    .from("prayer_commitments")
    .select("id, name, email, church_id")
    .eq("reminder_active", true)
    .or(`last_reminded_at.is.null,last_reminded_at.lt.${thirtyDaysAgo.toISOString()}`);

  if (error) {
    console.error("Failed to fetch commitments:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results = await Promise.allSettled(
    (commitments ?? []).map(async (c) => {
      const unsubscribeUrl = `${appUrl}/unsubscribe?id=${c.id}`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Prayer Wall <reminders@your-domain.com>",
          to: c.email,
          subject: "Your monthly prayer reminder",
          html: `
            <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
              <h2 style="color: #78350f;">Hi ${c.name},</h2>
              <p>This is your monthly reminder that you committed to pray.
                 Thank you for being part of the prayer wall.</p>
              <p>Your prayers make a difference. Keep going.</p>
              <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
              <p style="font-size: 12px; color: #78716c;">
                You're receiving this because you placed your name on the prayer wall.
                <a href="${unsubscribeUrl}" style="color: #78716c;">Unsubscribe</a>
              </p>
            </div>
          `,
        }),
      });

      const resendData = await res.json() as { id?: string };
      const status = res.ok ? "sent" : "failed";

      await supabase.from("email_logs").insert({
        church_id: c.church_id,
        commitment_id: c.id,
        email: c.email,
        status,
        resend_message_id: resendData.id ?? null,
      });

      if (!res.ok) throw new Error(`Resend error for ${c.email}: ${res.status}`);
      return c.id;
    }),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  const sentIds = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value);

  if (sentIds.length > 0) {
    await supabase.from("prayer_commitments")
      .update({ last_reminded_at: new Date().toISOString() })
      .in("id", sentIds);
  }

  return new Response(
    JSON.stringify({ sent, failed, total: commitments?.length ?? 0 }),
    { headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
  );
});
