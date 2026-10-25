import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

const app = express();
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const BODY_LIMIT = "64kb";
const RESPONSE_LIMIT_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_DIGEST = process.env.API_TOKEN_SHA256 || "";
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function loadUpstreams() {
  let parsed;
  try {
    parsed = JSON.parse(process.env.UPSTREAMS_JSON || "{}");
  } catch {
    throw new Error("UPSTREAMS_JSON must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("UPSTREAMS_JSON must be an object of service names to HTTPS URLs");
  }
  const output = new Map();
  for (const [name, value] of Object.entries(parsed)) {
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(name)) {
      throw new Error(`Invalid upstream service name: ${name}`);
    }
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`Invalid upstream URL for ${name}`);
    }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      throw new Error(`Upstream ${name} must be a clean HTTPS base URL without credentials, query or fragment`);
    }
    if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") ||
        url.hostname === "127.0.0.1" || url.hostname === "::1" ||
        url.hostname.startsWith("10.") || url.hostname.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)) {
      throw new Error(`Private/local upstream hosts are not allowed in this public-gateway prototype: ${name}`);
    }
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    output.set(name, url);
  }
  return output;
}

function validDigest(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean)
);

app.disable("x-powered-by");
app.set("trust proxy", 1); // Configure only when deployed behind exactly one trusted proxy.
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403);
  next();
});

app.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store").json({ status: "ok", service: "nitin-secure-api-cloud", version: "0.1.0" });
});

app.use("/api", rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "rate_limit_exceeded" }
}));

app.use("/api", express.json({ limit: BODY_LIMIT, strict: true, type: ["application/json", "application/*+json"] }));

app.use("/api/:service", async (req, res) => {
  if (!validDigest(TOKEN_DIGEST)) {
    return res.status(503).json({ error: "gateway_not_configured", message: "Set API_TOKEN_SHA256 to a SHA-256 hex digest of a long random bearer token." });
  }
  if (!METHODS.has(req.method)) {
    res.set("Allow", [...METHODS].join(", "));
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const auth = req.get("authorization") || "";
  const match = /^Bearer ([A-Za-z0-9._~-]{32,512})$/.exec(auth);
  if (!match) return res.status(401).json({ error: "unauthorized" });

  const supplied = crypto.createHash("sha256").update(match[1], "utf8").digest();
  const expected = Buffer.from(TOKEN_DIGEST, "hex");
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  let upstreams;
  try {
    upstreams = loadUpstreams();
  } catch {
    return res.status(503).json({ error: "upstream_configuration_invalid" });
  }
  const base = upstreams.get(req.params.service);
  if (!base) return res.status(404).json({ error: "unknown_service" });

  const suffix = req.path.replace(/^\//, "");
  const target = new URL(suffix, base);
  target.search = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) {
    return res.status(400).json({ error: "invalid_upstream_path" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers = { accept: req.get("accept") || "application/json" };
    if (req.is(["application/json", "application/*+json"]) && req.body !== undefined) {
      headers["content-type"] = "application/json";
    }
    const init = {
      method: req.method,
      headers,
      redirect: "error",
      signal: controller.signal
    };
    if (["POST", "PUT", "PATCH"].includes(req.method) && req.body !== undefined) {
      init.body = JSON.stringify(req.body);
    }
    const upstreamResponse = await fetch(target, init);
    const body = await upstreamResponse.arrayBuffer();
    if (body.byteLength > RESPONSE_LIMIT_BYTES) {
      return res.status(502).json({ error: "upstream_response_too_large" });
    }
    res.status(upstreamResponse.status);
    const contentType = upstreamResponse.headers.get("content-type");
    if (contentType) res.set("Content-Type", contentType);
    res.set("Cache-Control", "no-store");
    // Intentionally do not forward cookies, hop-by-hop headers, or upstream server headers.
    return res.send(Buffer.from(body));
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    return res.status(timedOut ? 504 : 502).json({ error: timedOut ? "upstream_timeout" : "upstream_unavailable" });
  } finally {
    clearTimeout(timer);
  }
});

app.use((err, _req, res, _next) => {
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "request_too_large" });
  if (err instanceof SyntaxError && "body" in err) return res.status(400).json({ error: "invalid_json" });
  return res.status(500).json({ error: "internal_error" });
});

if (process.env.NODE_ENV !== "test") {
  if (!validDigest(TOKEN_DIGEST)) {
    console.error("WARNING: API_TOKEN_SHA256 is missing or invalid. Protected routes will return 503.");
  }
  app.listen(PORT, HOST, () => {
    console.log(`Nitin Secure API Cloud prototype listening on ${HOST}:${PORT}`);
  });
}

export default app;
