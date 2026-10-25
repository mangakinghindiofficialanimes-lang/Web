# DRM Architecture — Nitin Secure API Cloud

## Status

**Design specification only — not production DRM.** The current API gateway does not encrypt media, issue DRM licenses, or stop copying. Do not advertise the prototype as a DRM service or use it for commercial/premium media until the integrations and security review below are complete.

## Scope

This module is for media/content owners who have the rights to distribute the content. It is separate from API transport security: TLS protects network connections, API authentication protects endpoints, and DRM controls access to encrypted media through supported client DRM systems.

A browser-only custom encryption scheme is not equivalent to commercial DRM. For supported premium playback, integrate licensed DRM systems:
- **Google Widevine** for supported Chrome, Firefox, Android and other compatible clients.
- **Apple FairPlay Streaming** for supported Safari/iOS/tvOS clients; requires Apple's approved setup/certificates.
- **Microsoft PlayReady** for compatible Windows, Edge, TV and device clients.

Availability varies by browser, OS, device hardware, codec, encryption scheme and security level. Detect capability at playback time and provide a clear unsupported-device message. Never promise that every browser/device supports every DRM.

## Target architecture

1. **Content ingest**
   - Accept only content the tenant owns or is licensed to distribute.
   - Validate file type and size; quarantine uploads; scan and transcode in isolated workers.
   - Keep originals private. Do not serve master files from a public bucket or static web directory.

2. **Packaging and encryption**
   - Package supported output as encrypted HLS and/or MPEG-DASH/CMAF, according to the chosen vendor's compatibility matrix.
   - Generate unique content keys per asset or key period through a key-management integration.
   - Keep raw content keys out of the application database, logs, browser code, source control and environment dumps.
   - Use a managed KMS/HSM or DRM vendor key service; define key rotation, access separation, backup and recovery.
   - The gateway must not invent a home-grown DRM protocol or return raw decryption keys to clients.

3. **Identity and entitlement**
   - Authenticate the user with the platform's identity service.
   - Check tenant, asset, subscription/purchase entitlement, publication state, region policy (where lawful), expiry and concurrent-session/device limits.
   - Issue short-lived, signed playback tokens scoped to one asset, one tenant, allowed DRM endpoints and a short expiry.
   - Keep token signing keys in a secret manager/KMS; support rotation and revocation.
   - Never accept an arbitrary upstream URL, asset ID without tenant scoping, or user-supplied license URL.

4. **License proxy / license service**
   - Use a commercial DRM provider or an authorized Widevine/FairPlay/PlayReady license server. These systems have vendor-specific challenge/response protocols and licensing requirements.
   - Verify playback token, asset entitlement, expiry, origin/app policy, rate limits and replay/session rules before forwarding a license challenge.
   - Forward the vendor protocol without logging license challenges, license responses, content keys, certificates, authorization headers or personal data.
   - Do not implement a fake endpoint that returns a made-up license. A mock can only be used for tests and must be clearly marked non-functional.
   - Keep license signing/key-service credentials separate from normal API gateway credentials.

5. **Delivery**
   - Store encrypted segments and manifests in private object storage/CDN origins.
   - Deliver only encrypted media using short-lived signed URLs/cookies or CDN token authorization.
   - Block public bucket listing and direct origin access. Restrict origin access to the CDN/tunnel identity.
   - Set appropriate CORS only for known player origins, cache policy deliberately, and avoid caching user-specific license responses.
   - Do not expose storage credentials, origin addresses or long-lived signed links in client code.

6. **Player**
   - Use the browser's supported Encrypted Media Extensions (EME) implementation and a maintained media player compatible with the selected DRM provider.
   - Configure the correct license endpoint and certificate settings per DRM vendor. Do not put secret credentials in JavaScript.
   - Select HLS/FairPlay or DASH/Widevine/PlayReady as supported by the device; compatibility must be tested on real devices.
   - A custom UI may discourage casual sharing, but hiding controls, disabling right-click, or blocking developer tools is not security.

7. **Audit and response**
   - Log minimally: tenant, asset, pseudonymous account/session ID, decision, timestamp, DRM system, coarse failure reason and request correlation ID.
   - Never log plaintext content, raw keys, bearer tokens, license payloads or full personal identifiers.
   - Alert on repeated failed licenses, token replay, unusual concurrency and abuse patterns.
   - Define a documented incident process, key rotation/revocation, account/session revocation, backup restoration and security patch SLAs.

## Threat model and honest limits

DRM can restrict unauthorized playback and make extraction harder, especially when hardware-backed DRM is available. It cannot guarantee that content will never be copied: a user may record a display or capture content on a compromised device. Watermarking, monitoring and legal/licensing controls can reduce risk but do not eliminate it.

TLS alone is not DRM. Encrypting a file with AES and shipping the decryption key in the frontend is not secure DRM. ClearKey is useful for development/testing, not a production replacement for Widevine, FairPlay or PlayReady. Never market this system as “unhackable.”

## Rollout plan

### Phase 0 — Requirements and provider selection
- Choose media types, target devices/browsers, expected concurrency, regions and content rights.
- Select an authorized DRM vendor/packager/CDN that supports the required DRM systems and browser matrix.
- Confirm commercial terms, license server onboarding, FairPlay certificate process, key ownership/export restrictions, data location, SLA and cost.
- Do not assume all components can be provided on free tiers or that free hosting provides 24/7 availability.

### Phase 1 — Local integration contract
- Add interfaces for EntitlementService, PlaybackTokenService, DrmProvider, AssetRepository and AuditSink.
- Add provider adapters only after credentials and vendor documentation are available.
- Use fake provider fixtures in automated tests; fixtures must never issue usable content keys or be exposed in production.
- Add negative tests for expired tokens, wrong tenant, missing entitlement, revoked session, unknown asset, oversized body, replay and rate limits.

### Phase 2 — Private staging
- Deploy behind HTTPS on a private/staging domain.
- Use test media that the project owns or is licensed to use.
- Validate Widevine on supported Chrome/Android devices, FairPlay on supported Safari/iOS devices and PlayReady on chosen compatible clients.
- Test browser versions, device security levels, offline behavior (if enabled), license renewal, expiry, concurrency and network interruption.
- Run a third-party security review before production.

### Phase 3 — Production readiness gate
- Use managed KMS/HSM and secret manager; no hard-coded keys.
- Use persistent shared rate limits/session storage and database-backed tenant isolation.
- Verify private storage/CDN origin controls and tunnel authentication.
- Enable dependency pinning/lockfile, SAST, dependency scanning, secret scanning, SBOM, backup/restore drills and monitored alerts.
- Define incident response, patch ownership, retention/deletion policy and customer support process.
- Obtain explicit approval from the content owner and DRM provider before launching protected content.

## Browser and platform notes

DRM support is not universal. Use runtime capability detection and a maintained provider compatibility matrix rather than browser-name guesses. Test actual combinations of browser, operating system, codec, packaging mode, hardware security level and playback resolution. When unsupported, fail closed for protected content and show a helpful compatibility message.

## Acceptance criteria

- No public route can return raw content keys or unencrypted premium media.
- License issuance requires a valid, unexpired playback token and current entitlement.
- Tokens are asset-scoped, short-lived, revocable and validated server-side.
- All secrets are stored outside Git and outside frontend bundles.
- Private storage cannot be accessed directly without the delivery authorization mechanism.
- Tests cover denied access and tenant isolation, not only successful playback.
- License and key payloads are redacted from logs.
- Production readiness is explicitly blocked until the chosen DRM provider is integrated and a security review is completed.

## References

- Google Widevine overview and licensing note: https://developers.google.com/widevine
- W3C Encrypted Media Extensions: https://www.w3.org/TR/encrypted-media/
- Apple FairPlay Streaming: https://developer.apple.com/streaming/fps/
- Microsoft PlayReady documentation: https://learn.microsoft.com/en-us/playready/
