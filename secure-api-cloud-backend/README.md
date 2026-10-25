# Nitin Secure API Cloud backend — v0.1

This is an early Node.js HTTPS-gateway application intended for a controlled test environment. It is not a complete secure API hosting service and must not be used for sensitive or production traffic yet.

## Included

- Node.js 22+ and Express 5.
- Helmet security headers.
- A health endpoint at `/health`.
- Bearer-token authentication checked using a SHA-256 token digest and timing-safe comparison.
- Fixed, administrator-configured upstream registry (no URL supplied by public callers).
- HTTPS-only upstream configuration, redirects rejected, request-size limit, response-size limit, timeout, basic rate limiting, and minimal response-header forwarding.
- A small automated test suite.
- DRM architecture and production rollout specification in [DRM-ARCHITECTURE.md](./DRM-ARCHITECTURE.md).
- User-requested protection profile and approval workflow specification in [PROTECTION-REQUESTS.md](./PROTECTION-REQUESTS.md).

The two documents above describe the intended design; they are not working DRM or a functioning request portal.

## Not included yet

- An actual outbound origin-tunnel agent or mTLS identity system.
- Per-user accounts, per-API tokens, database-backed route registry, quotas or billing.
- A managed vault, automatic key rotation, robust distributed rate limiting, WAF or DDoS service.
- End-to-end payload encryption.
- Working Widevine, FairPlay or PlayReady license integration, media packaging, or a protected media player.
- A working user request portal, database-backed policy engine or approval dashboard.
- Automatic server/OS patching on customer-owned origins.
- A production security audit.

## Run locally

Requires Node.js 22 or newer.

1. Copy `.env.example` to `.env`.
2. Generate a random bearer token of at least 32 characters and store it privately.
3. Calculate the SHA-256 digest of the token and set that digest as `API_TOKEN_SHA256`. The token itself is sent as the `Authorization: Bearer ...` header by a client; do not put it in a URL or commit it.
4. Set `UPSTREAMS_JSON` to a JSON object containing only HTTPS origin URLs you own or are explicitly authorized to call.
5. Run `npm install`, then `npm test`, then `npm start`.

Example digest command:
```sh
node -e "console.log(require('node:crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" 'PASTE_YOUR_PRIVATE_RANDOM_TOKEN_HERE'
```
Do not paste real tokens into public chat, GitHub, screenshots, or issue reports. Prefer a hosting provider's secret manager for deployments.

## Routes

- `GET /health` — non-sensitive health status.
- `/api/:service/*` — authenticated relay to the registered HTTPS base URL for that service. The caller cannot select an arbitrary upstream URL.

For example, if the administrator configures `{"demo":"https://api.your-domain.example/v1/"}`, then a request to `/api/demo/status` is relayed to that registered origin. Replace the example with a real API you own. A service may require additional origin-specific authorization; this prototype does not forward the caller's Authorization header.

## Important deployment warnings

- Use a hosting provider that supports Node.js 22+ and set environment variables through its secret UI, not in Git.
- Do not enable public browser CORS until you know the exact frontend origins. CORS is not authentication.
- The example rate limiter uses in-memory state and is not sufficient across multiple instances or as a DDoS defense.
- The prototype rejects some private/local hostnames, but hostname checks alone are not a full SSRF defense. Before public deployment, enforce DNS/IP egress policy and revalidate resolved addresses, including redirects and DNS rebinding protections.
- Configure `trust proxy` for the exact number of trusted proxies in the chosen host; incorrect proxy trust can weaken IP-based rate limiting.
- HTTPS from the gateway to an origin is encrypted in transit but does not hide request plaintext from a gateway that terminates client TLS. For gateway-blind payload confidentiality, add application-layer end-to-end encryption and client/origin key handling.
- Do not promise that this prototype protects a server from every attack. Test, threat-model, and obtain an independent security review before production use.
- DRM support is not universal across browsers and devices. A licensed DRM provider and platform-specific testing are required before production.
- Users may request extra protection, but changes must be reviewed, tested and approved before production rollout. See [PROTECTION-REQUESTS.md](./PROTECTION-REQUESTS.md).

## Next milestone

Implement authenticated tenant accounts and a database-backed protection request workflow, then an owner-enrolled outbound tunnel with per-origin credentials, revocation and heartbeat. Replace the shared prototype bearer token with per-user/per-API credentials and a server-side secret manager. DRM provider integration begins only after the media requirements and licensed provider are chosen.
