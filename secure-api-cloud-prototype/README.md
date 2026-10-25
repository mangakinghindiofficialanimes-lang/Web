# Nitin Secure API Cloud — prototype

This directory begins the design and UI for an API security gateway. It is deliberately **not** a production proxy or encryption service yet.

## What this prototype does

- Provides a static, mobile-friendly dashboard mock-up.
- Documents the intended request path and safe release requirements.
- Is suitable for previewing from GitHub Pages or another static host.

## What it does not do yet

- It does not route API traffic.
- It does not create or manage cryptographic keys.
- It does not connect to an origin tunnel.
- It does not scan servers or install patches.
- It does not protect a real API. The dashboard status values are illustrative.

Do not enter API keys, passwords, private keys, or production data into this page.

## Preview from an Android browser

1. Open the repository on GitHub.
2. Switch to branch `feature/secure-api-cloud-prototype`.
3. Open `secure-api-cloud-prototype/index.html` to inspect the source.
4. To publish a preview, use a separate GitHub Pages site or a static-hosting project with this directory as its publish directory. Static hosting only publishes the dashboard; it does not create the gateway backend.

## Recommended staged implementation

1. **Static dashboard:** this prototype.
2. **Gateway proof of concept:** use a managed edge runtime, strict registered-origin allowlists, HTTPS-only upstreams, request size limits, authentication, rate limiting and audit-safe logs.
3. **Origin connectivity:** for a server the owner controls, use an outbound tunnel such as Cloudflare Tunnel. Keep its token on the origin host; never expose it in browser JavaScript. A tunnel provides connectivity, not authorization by itself.
4. **Key lifecycle:** use platform-managed secrets or a dedicated vault; separate keys by purpose; rotate and revoke keys; restrict access; do not log secrets.
5. **CI security checks:** dependency alerts, static analysis, secret scanning, tests and signed release artifacts.
6. **Staging then production:** test patches on a disposable environment; canary deploy; health-check; roll back if checks fail.
7. **Production review:** threat model, independent security review, backups, abuse response, incident procedures and privacy/legal review.

## Free-tier caveats

Free tiers change and may impose quotas, sleeping, execution limits, bandwidth limits, or terms that restrict certain uses. Confirm current provider limits before promising free 24/7 service. TLS and tunnel usage may be free for some configurations, but API traffic, storage, logs and abuse protection can still incur costs.

## Security policy

See [SECURITY-PLAN.md](SECURITY-PLAN.md). The weekly review is not a reason to delay urgent fixes: critical vulnerabilities should be triaged immediately. Automatically generated update pull requests must pass tests and be reviewed before deployment; do not blindly auto-deploy unreviewed patches to customer-owned servers.
