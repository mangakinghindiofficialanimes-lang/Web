# NITIN ANIMES

A mobile-friendly anime discovery website starter with a custom crown wordmark, catalogue management, Supabase authentication, episode source management, user administration, and activity analytics.

## What is implemented in the repository

- Public catalogue with search and genre filters; reads published titles from Supabase when configured.
- Dedicated anime detail pages (`anime.html`) and episode watch pages (`watch.html`), including authorised video playback and download links.
- Anime detail dialogs and published episode list; HTML video playback for authorised direct video URLs and links to authorised downloads.
- Admin sign-in using Supabase Auth and a database-backed admin role check.
- Admin dashboard UI for anime and episode CRUD, user account/role management through an Edge Function, and recent activity analytics.
- Member account page with email/password sign-up and sign-in, private watchlist, and continue-watching progress.
- Supabase SQL schema with Row Level Security (RLS).
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

## 3. Deploy the site to Netlify

1. Open [Netlify](https://app.netlify.com/).
2. Choose **Add new project → Import an existing project**, then select this GitHub repository.
3. Branch: \`main\`. Build command: leave blank. Publish directory: \`.\`.
4. Deploy. After changing the Supabase config, redeploy or wait for the Git integration to build the new commit.
5. In Supabase Auth, add your deployed Netlify URL to the allowed site and redirect URLs.

Guide: [Deploy from a repository](https://docs.netlify.com/start/quickstarts/deploy-from-repository/).

## 4. Member accounts and personal library

Open `account.html` to create an account or sign in. After applying the updated `supabase/schema.sql`, members can see their private watchlist and continue-watching progress. Playback progress is saved only for a signed-in user; anonymous viewing still works but is not attached to a personal account.

## 5. Add anime and episode sources

Sign into \`/admin.html\` with the account whose profile has the \`admin\` role. Add anime, then add episodes. Only use video/download URLs for content you own or are authorised to distribute. Direct \`.mp4\` URLs work with the built-in HTML video player; third-party providers may need their own permitted embed/player integration. Do not upload or link copyrighted episodes without permission.

Cover URLs should be public HTTPS image URLs. For private video files, use private Supabase Storage buckets and short-lived signed URLs from a server-side endpoint; do not make private files public.

## 6. Security and remaining production work

- Never commit a database password, Supabase secret key, or service-role key.
- RLS protects database rows; frontend visibility checks alone are not security.
- The sample catalogue is illustrative and includes no episode media.
- User creation/deletion requires the Edge Function deployed and configured.
- Test every role with separate viewer and admin accounts before using real users.
- Analytics only count events recorded after the schema is installed; this is not historical analytics or an external analytics service.
- For a public launch, add rate limiting/abuse monitoring, backups, error monitoring, legal pages, privacy notice, and thorough security testing.
