// Opt-out endpoint for both products:
//   ?id=<commitment uuid>     → prayer wall: stop reminder emails
//   ?donation=<donation uuid> → giving wall: set donations.email_opt_out
//
// The giving wall needs this function because RLS only lets service_role update
// prayer_wall.donations — the browser cannot opt a donor out directly.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

const JSON_HEADERS = { "Content-Type": "application/json", ...CORS_HEADERS };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  let commitmentId = url.searchParams.get("id");
  let donationId = url.searchParams.get("donation");

  // supabase-js functions.invoke() sends a POST body rather than query params.
  if (!commitmentId && !donationId && req.method === "POST") {
    try {
      const body = await req.json() as { commitment_id?: string; donation_id?: string };
      commitmentId = body.commitment_id ?? null;
      donationId = body.donation_id ?? null;
    } catch {
      // fall through to the missing-id response below
    }
  }

  if (!commitmentId && !donationId) {
    return new Response(
      JSON.stringify({ error: "Missing commitment or donation id" }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { db: { schema: "prayer_wall" } },
  );

  const { error } = donationId
    ? await supabase.from("donations").update({ email_opt_out: true }).eq("id", donationId)
    : await supabase.from("commitments").update({ reminder_active: false }).eq("id", commitmentId!);

  if (error) {
    console.error("unsubscribe failed:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: JSON_HEADERS },
    );
  }

  return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
});
