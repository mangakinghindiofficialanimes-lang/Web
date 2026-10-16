import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_BOT_API_FILE_BYTES = 20 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_KEY_RE = /^[A-Za-z0-9._/-]{1,200}$/;

function cors(origin: string) {
  const configured = Deno.env.get("NITIN_SITE_ORIGIN") || "*";
  const allowed = configured === "*" || origin === configured ? (configured === "*" ? "*" : configured) : "null";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, range",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Expose-Headers": "content-length, content-type, accept-ranges",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff"
  };
}
function json(body: unknown, status: number, headers: Record<string,string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const headers = cors(req.headers.get("Origin") || "");
  if (headers["Access-Control-Allow-Origin"] === "null") return json({ error: "Origin not allowed." }, 403, headers);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "Method not allowed." }, 405, headers);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  if (!supabaseUrl || !anonKey || !serviceKey || !botToken) {
    return json({ error: "Telegram media service is not configured. Set server-side Supabase and Telegram secrets." }, 503, headers);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Sign-in required." }, 401, headers);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Invalid or expired session." }, 401, headers);

  // Supabase may expose the path with or without the external /functions/v1 prefix.
  const marker = "telegram-media";
  const markerAt = url.pathname.lastIndexOf(marker);
  if (markerAt < 0) return json({ error: "Invalid media route." }, 404, headers);
  const route = url.pathname.slice(markerAt + marker.length).replace(/^\/+/, "");
  const parts = route.split("/");
  const manifestId = parts.shift() || "";
  const assetKey = parts.join("/") || "manifest.mpd";
  if (!UUID_RE.test(manifestId) || !SAFE_KEY_RE.test(assetKey) || assetKey.split("/").some(p => p === "..")) {
    return json({ error: "Invalid media asset path." }, 400, headers);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: manifest, error: manifestError } = await admin
    .from("telegram_media_assets")
    .select("id,episode_id,asset_key,asset_role,manifest_text")
    .eq("id", manifestId)
    .eq("asset_role", "manifest")
    .maybeSingle();
  if (manifestError || !manifest) return json({ error: "Media manifest not found." }, 404, headers);

  const { data: episode, error: episodeError } = await admin
    .from("episodes")
    .select("id,is_published,anime(status)")
    .eq("id", manifest.episode_id)
    .maybeSingle();
  if (episodeError || !episode || !episode.is_published || episode.anime?.status !== "published") {
    return json({ error: "Episode is not available." }, 403, headers);
  }

  const endpointBase = url.origin + url.pathname.slice(0, markerAt + marker.length);
  if (assetKey === "manifest.mpd") {
    if (typeof manifest.manifest_text !== "string" || !manifest.manifest_text.includes("<MPD")) {
      return json({ error: "Stored DASH manifest is invalid." }, 500, headers);
    }
    // The manifest uses telegram-asset://<asset-key> markers. Replace these at
    // request time so Telegram file IDs and bot credentials never reach browsers.
    const rewritten = manifest.manifest_text.replace(/telegram-asset:\/\//g, endpointBase + "/" + manifestId + "/");
    return new Response(req.method === "HEAD" ? null : rewritten, {
      status: 200,
      headers: { ...headers, "Content-Type": "application/dash+xml; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }
    });
  }

  const { data: asset, error: assetError } = await admin
    .from("telegram_media_assets")
    .select("telegram_file_id,mime_type")
    .eq("episode_id", manifest.episode_id)
    .eq("asset_key", assetKey)
    .eq("asset_role", "segment")
    .maybeSingle();
  if (assetError || !asset?.telegram_file_id) return json({ error: "Media segment not found." }, 404, headers);

  try {
    const getFileResponse = await fetch("https://api.telegram.org/bot" + botToken + "/getFile?file_id=" + encodeURIComponent(asset.telegram_file_id));
    if (!getFileResponse.ok) return json({ error: "Telegram file lookup failed." }, 502, headers);
    const fileInfo = await getFileResponse.json();
    const filePath = fileInfo?.ok && fileInfo?.result?.file_path;
    const fileSize = Number(fileInfo?.result?.file_size || 0);
    if (!filePath) return json({ error: "Telegram did not return a file path." }, 502, headers);
    if (fileSize > MAX_BOT_API_FILE_BYTES) {
      return json({ error: "This Telegram Bot API proxy supports files up to 20 MB. Package smaller media segments (target 15 MB or less)." }, 413, headers);
    }
    const download = await fetch("https://api.telegram.org/file/bot" + botToken + "/" + filePath);
    if (!download.ok || !download.body) return json({ error: "Telegram media download failed." }, 502, headers);
    const mime = typeof asset.mime_type === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(asset.mime_type) ? asset.mime_type : "application/octet-stream";
    const responseHeaders = new Headers(headers);
    responseHeaders.set("Content-Type", mime);
    responseHeaders.set("Cache-Control", "private, no-store");
    responseHeaders.set("Accept-Ranges", "none");
    const length = download.headers.get("content-length");
    if (length) responseHeaders.set("Content-Length", length);
    return new Response(req.method === "HEAD" ? null : download.body, { status: 200, headers: responseHeaders });
  } catch {
    return json({ error: "Telegram media proxy request failed." }, 502, headers);
  }
});
