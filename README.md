# NITIN ANIMES

A mobile-friendly anime discovery website starter with a custom crown wordmark, catalogue management, Supabase authentication, episode source management, user administration, and activity analytics.

## What is implemented in the repository

- Public catalogue with search and genre filters; reads published titles from Supabase when configured.
- Dedicated anime detail pages (`anime.html`) and a Widevine/Shaka protected-player integration on `watch.html`; direct MP4 playback and exposed download links are disabled in the protected player.
- Protected offline-library UI using browser-managed Shaka storage, subject to provider support for persistent Widevine licenses.
- Admin sign-in using Supabase Auth and a database-backed admin role check.
- Admin dashboard UI for anime and episode CRUD, user account/role management through an Edge Function, and recent activity analytics.
- Member account page with email/password sign-up and sign-in, private watchlist, and continue-watching progress.
- Supabase SQL schema with Row Level Security (RLS).
- Installable Progressive Web App (PWA) manifest and original crown app icon.
- Offline fallback and cache for the static site shell; streaming, authentication and live data still need internet.
- Netlify static-hosting settings.

The admin dashboard and live catalogue require your Supabase project to be configured. User management additionally requires deploying the Edge Function below. Do not treat an unconfigured preview as production-ready.

## 1. Configure the database

1. Open your Supabase project dashboard.
2. Open **SQL Editor**, paste the contents of \`supabase/schema.sql\`, and run it.
3. Open **Project Settings → API** and copy the Project URL and public anon/publishable key.
4. Edit \`supabase-config.js\` in GitHub and replace the two placeholders. Only use the public anon/publishable key in browser code. Never put a service-role/secret key in GitHub or the browser.
5. In **Authentication → Users**, create or sign up your own account. Copy its user UUID.
6. In SQL Editor, run this with your UUID:
   \`\`\`sql
   update public.profiles set role='admin' where id='YOUR-AUTH-USER-UUID';
   \`\`\`
7. For a production site, configure allowed redirect URLs and email verification in Supabase Auth.

## 2. Deploy the user-management Edge Function

The browser cannot safely create or delete Auth users with elevated privileges. The admin page calls \`manage-users\`, which must run server-side and verifies the caller's signed-in identity and database admin role before any privileged action. Supabase Edge Functions keep secret keys on the server, not in the browser. See [Supabase Edge Function security](https://supabase.com/docs/guides/functions/auth) and [secrets](https://supabase.com/docs/guides/functions/secrets).

From a computer with the Supabase CLI, link your project, then deploy:
\`\`\`sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy manage-users
\`\`\`
The hosted function receives the project's server-side environment variables. If your project setup uses custom environment names, configure \`SUPABASE_URL\`, \`SUPABASE_ANON_KEY\`, and \`SUPABASE_SERVICE_ROLE_KEY\` as server-side function secrets. Never commit them. The function code uses the legacy service-role environment variable as a server-only secret; use your current Supabase dashboard's secret key configuration appropriate for your project.

## 3. Installable app and offline support

The homepage, anime details, watch page, and account page register `pwa.js`. On a supported browser over HTTPS, visitors may use the browser menu to install NITIN ANIMES. The service worker caches the static site shell and shows `offline.html` when navigation fails offline. Supabase data, sign-in, video streaming, and downloads are not available without a connection. If you update static assets, bump `CACHE_NAME` in `sw.js` so devices refresh the cache.

## 4. Deploy the site to Netlify

1. Open [Netlify](https://app.netlify.com/).
2. Choose **Add new project → Import an existing project**, then select this GitHub repository.
3. Branch: \`main\`. Build command: leave blank. Publish directory: \`.\`.
4. Deploy. After changing the Supabase config, redeploy or wait for the Git integration to build the new commit.
5. In Supabase Auth, add your deployed Netlify URL to the allowed site and redirect URLs.

Guide: [Deploy from a repository](https://docs.netlify.com/start/quickstarts/deploy-from-repository/).

## 5. Member accounts and personal library

Open `account.html` to create an account or sign in. After applying the updated `supabase/schema.sql`, members can see their private watchlist and continue-watching progress. Playback progress is saved only for a signed-in user; anonymous viewing still works but is not attached to a personal account.

## 6. Add anime and episode sources

Sign into \`/admin.html\` with the account whose profile has the \`admin\` role. Add anime, then add episodes. Only use video/download URLs for content you own or are authorised to distribute. Direct \`.mp4\` URLs work with the built-in HTML video player; third-party providers may need their own permitted embed/player integration. Do not upload or link copyrighted episodes without permission.

Cover URLs should be public HTTPS image URLs. For private video files, use private Supabase Storage buckets and short-lived signed URLs from a server-side endpoint; do not make private files public.

## 7. Widevine DRM and protected offline playback

The watch page now uses Shaka Player with Widevine DRM configuration and refuses to fall back to clear MP4 playback. It expects an HTTPS DASH .mpd or DRM-packaged HLS .m3u8 manifest, a real Widevine license server, and a server-side authorization endpoint. This is a browser media player, not VLC embedded in Chrome.

### External service you must configure

Netlify/GitHub and Supabase do not issue Widevine licenses or package videos for DRM. Choose a commercial DRM/video platform that explicitly supports Google Widevine, encrypted DASH/HLS packaging, license authorization, and persistent/offline licenses for Android Chrome. Ask the vendor to confirm persistent browser licenses on your target devices before paying. Vendors to evaluate include castLabs DRMtoday, BuyDRM KeyOS, and EZDRM; these are examples to investigate, not services already integrated or endorsed by this repository.

1. Create a provider account and configure a Widevine license service.
2. Package videos you own or are licensed to distribute as DRM-encrypted DASH (.mpd) or supported DRM HLS (.m3u8). For Telegram storage, follow [TELEGRAM_STORAGE.md](TELEGRAM_STORAGE.md) to store encrypted segments as individual Telegram files and register their file IDs privately.
3. In drm-config.js, set widevineLicenseServerUrl to the provider's HTTPS license URL and licenseTokenEndpoint to your server-side authorization endpoint. These are endpoint URLs, not secrets.
4. The repository includes `supabase/functions/drm-license-auth/index.ts` as a fail-closed scaffold. Deploy it with `supabase functions deploy drm-license-auth`, then integrate your chosen provider's server-side SDK/API. The scaffold validates the signed-in user and published episode, then returns HTTP 503 until a provider adapter is implemented. The finished endpoint must create provider-specific short-lived license authorization and return a JSON object with a headers map using the exact header format required by the provider. Never return signing keys or provider secrets. Do not blindly proxy arbitrary URLs or authorize arbitrary episode IDs.
5. Configure the provider license server to reject requests without valid authorization and to issue persistent licenses only when supported. Allowlist your website origin in the provider's CORS settings.
6. Test a real encrypted sample in Chrome on Android and verify license requests in provider logs before adding production videos.

### Protected offline behavior

The Save for offline button uses Shaka browser offline storage and requests a persistent DRM license. It stores protected media in the browser-managed storage, not as a normal MP4 file. The Offline library can list, play, and delete content saved in that browser profile. This requires the DRM provider to permit persistent Widevine licenses, browser/device support, sufficient storage, and a valid license period. Clearing browser site data may delete saved content. The Shaka runtime is cached after its first successful online load, but initial setup must happen online.

The nodownload control and context-menu suppression are only interface restrictions. DRM raises the barrier to copying but cannot guarantee prevention of screen recording, rooted-device capture, or every attack. FairPlay and PlayReady are not configured in this Android-first implementation.

### Current status

The repository contains the player integration and endpoint placeholders only. It is not yet working DRM until you select a provider, package encrypted media, and deploy the authorization endpoint. Do not paste provider secrets into GitHub, drm-config.js, or browser JavaScript.

## 8. Telegram storage integration status

The repository includes an authenticated Telegram media proxy and a private asset-index schema. This is a storage bridge, not a video packager or Widevine license server. The admin page does not yet upload Telegram files or create asset rows automatically; initial setup is documented in [TELEGRAM_STORAGE.md](TELEGRAM_STORAGE.md). Each proxied file must be below Telegram's hosted Bot API 20 MB download limit; target 15 MB or less.

## 9. Security and remaining production work

- Never commit a database password, Supabase secret key, or service-role key.
- RLS protects database rows; frontend visibility checks alone are not security.
- The sample catalogue is illustrative and includes no episode media.
- Telegram proxying requires a private channel, server-side bot token, asset schema, and Edge Function secrets.
- Telegram proxying adds latency and bandwidth usage; free tiers are for small tests, not guaranteed production delivery.
- User creation/deletion requires the Edge Function deployed and configured.
- Test every role with separate viewer and admin accounts before using real users.
- Analytics only count events recorded after the schema is installed; this is not historical analytics or an external analytics service.
- For a public launch, add rate limiting/abuse monitoring, backups, error monitoring, legal pages, privacy notice, and thorough security testing.
