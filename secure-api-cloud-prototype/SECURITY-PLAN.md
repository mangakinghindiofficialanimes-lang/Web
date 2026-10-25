# Nitin Secure API Cloud — security plan

## Security objectives

- Encrypt network traffic using maintained HTTPS/TLS implementations.
- Keep user-owned origin servers off the public inbound internet where tunnel architecture supports it.
- Authenticate each caller and authorize each API route independently.
- Keep secrets out of source code, browser bundles, URLs, and logs.
- Detect known vulnerable dependencies and deliver tested fixes quickly.
- Make clear that no system can promise perfect or permanent protection.

## Threat model (initial)

Protect against accidental origin exposure, unauthorized API calls, stolen credentials, excessive request volume, vulnerable dependencies, configuration mistakes, and unreviewed releases.

Out of scope for the first prototype: protecting a compromised origin operating system, defeating every denial-of-service attack, preventing users from misusing their own server, or guaranteeing confidentiality after a server decrypts data for processing.

## Request path

1. Client connects to the gateway over HTTPS.
2. Gateway validates authentication and authorization, rejects unknown routes and methods, applies size/time/rate limits, and records minimal non-sensitive audit metadata.
3. Gateway forwards only to an owner-enrolled origin identifier. Never accept an arbitrary upstream URL from a public request; that design can create server-side request forgery (SSRF).
4. Gateway-to-origin traffic uses an authenticated encrypted tunnel or mutually authenticated TLS.
5. Origin processes the request. Sensitive request bodies and responses must not be logged by default.
6. Responses return over the protected connection with appropriate cache and security headers.

A gateway that terminates TLS can read plaintext traffic. If the gateway must not read payloads, use application-level end-to-end encryption with client/origin-held keys and design the API around encrypted payloads. That limits gateway inspection and may not suit every API.

## Key management requirements

- Use standard, maintained cryptographic libraries and protocols; never invent encryption algorithms.
- Separate keys for sessions, signing, encryption and tunnel access.
- Generate keys with a cryptographically secure random generator.
- Store long-lived secrets in a server-side secret manager/vault, not in a public repository or browser.
- Limit which service identities can read each secret; audit access without logging secret values.
- Support rotation, revocation, expiry and emergency replacement.
- Keep private keys and tunnel tokens out of logs, issue reports and client-visible configuration.
- Use TLS certificate validation and fail closed when verification fails.

## Weekly review and urgent patches

### Every week
- Review dependency and platform security alerts.
- Check supported runtime versions, TLS configuration, permissions, secrets exposure, and security logs.
- Run automated tests, static analysis, dependency checks and a configuration review.
- Produce a report of new findings, accepted risks, fixes and owners.

### Critical vulnerability response
- Triage immediately; determine affected components and exposure.
- Apply a verified vendor fix or disable the affected feature while a fix is prepared.
- Build and test in CI; use staging and a canary rollout where feasible.
- Verify health checks and security regression tests.
- Roll back safely if checks fail; keep an incident record.
- Notify affected origin owners if their own software or operating system needs patching.

### Safe automation policy
- Automated scanners may create alerts and update pull requests.
- Do not blindly install arbitrary updates or auto-merge untrusted code.
- Require passing tests and protected-branch review before production deployment.
- Verify artifact provenance/signatures where supported.
- Keep a rollback path and test recovery.
- For customer-owned servers, the platform cannot patch an OS or application unless the owner has explicitly installed and authorized a trusted management agent. Prefer alerts and owner-approved updates.

## Required controls before public beta

- [ ] Strong authentication and per-route authorization.
- [ ] Strict upstream registry; no public arbitrary URL proxying.
- [ ] Request and response size/time limits, rate limiting and abuse handling.
- [ ] HTTPS/TLS end to end or a documented authenticated tunnel.
- [ ] Server-side secret store and tested key rotation/revocation.
- [ ] No secrets or sensitive payloads in logs.
- [ ] Dependency and secret scanning, static analysis and automated tests.
- [ ] Protected release branch, review, signed artifacts where available, staging and rollback.
- [ ] Monitoring, backup/recovery, incident response and a vulnerability-reporting contact.
- [ ] Independent security review before making strong protection claims.

## Reference documentation

- Cloudflare Tunnel: https://developers.cloudflare.com/tunnel/
- GitHub Dependabot security updates: https://docs.github.com/en/code-security/dependabot/dependabot-security-updates
- OWASP API Security guidance: https://devguide.owasp.org/en/07-training-education/07-api-top-ten/
- OWASP data protection and secrets guidance: https://devguide.owasp.org/en/04-design/02-web-app-checklist/08-protect-data/
