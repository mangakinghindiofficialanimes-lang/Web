import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const origin = Deno.env.get("NITIN_SITE_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!supabaseUrl || !anonKey) return json({ error: "Supabase function environment is not configured." }, 503);
  if (!token) return json({ error: "Sign-in required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userResult, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userResult.user) return json({ error: "Invalid or expired session." }, 401);

  let body: { episode_id?: string; asset_uri?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  if (!body.episode_id || typeof body.episode_id !== "string") return json({ error: "episode_id is required." }, 400);

  const { data: episode, error } = await userClient
    .from("episodes")
    .select("id,video_url,is_published,anime(status)")
    .eq("id", body.episode_id)
    .eq("is_published", true)
    .maybeSingle();
  if (error || !episode || episode.anime?.status !== "published") {
    return json({ error: "Episode is unavailable for this account." }, 403);
  }
  if (body.asset_uri && body.asset_uri !== episode.video_url) {
    return json({ error: "Requested asset does not match the episode record." }, 400);
  }

  // Intentional fail-closed scaffold. A provider-specific adapter must validate
  // entitlement and create short-lived license authorization on the server.
  // Do not replace this with a static secret or return signing keys to the browser.
  return json({
    error: "DRM provider adapter is not configured.",
    code: "drm_provider_adapter_required",
    message: "Integrate your chosen Widevine vendor's server-side authorization SDK/API before enabling playback."
  }, 503);
});