# NITIN ANIMES

A responsive anime-discovery website starter with an original text-and-crown brand mark, searchable sample catalogue, Supabase schema, and an admin sign-in starter.

## Files

- \`index.html\`, \`styles.css\`, \`app.js\` — responsive homepage, catalogue filters, and detail dialogs.
- \`admin.html\`, \`admin.js\` — Supabase Auth sign-in and database-backed admin-role check.
- \`supabase-config.js\` — public Supabase URL and anon/publishable key placeholders.
- \`supabase/schema.sql\` — database tables and Row Level Security (RLS) policies.
- \`netlify.toml\` — static hosting settings and basic response headers.

## Set up Supabase

1. Open your Supabase project dashboard.
2. Open **SQL Editor**, paste and run `supabase/schema.sql` from this repository.
3. Open `supabase-config.js` and replace the project URL and public anon/publishable key with values from **Project Settings → API**. These are public client settings; never paste a service-role or secret key into this file.
4. In **Authentication**, create your own user account. Use a strong, unique password and keep it private.
5. In **Authentication → Users**, copy your own user UUID. In the SQL Editor, run this statement after replacing the placeholder with your own UUID:
   ```sql
update public.profiles set role = 'admin' where id = 'YOUR-AUTH-USER-UUID';
```
6. Open `admin.html` and sign in. The page checks the user's role against the database. RLS policies remain the real database access control.

The admin portal is currently a **starter**: secure sign-in and role verification are scaffolded, but catalogue editing, user management, and analytics dashboards are not yet built.

## Deploy on Netlify

1. Sign in to Netlify.
2. Choose **Add new project → Import an existing project** and select this GitHub repository.
3. Use branch `main` and publish directory `.` (no build command is needed for this static starter).
4. Deploy. Future commits to the connected branch can trigger new deployments.

Official guide: https://docs.netlify.com/start/quickstarts/deploy-from-repository/

## Video and download policy

Only add video and download URLs for media you own or are authorised to distribute. The sample catalogue is illustrative and contains no episode files or streaming links. Before enabling downloads, confirm that your licences permit downloads and configure access controls for any private files.

## Important security notes

- Never commit Supabase service-role keys, database passwords, or other secrets.
- The public anon/publishable key is intended for browser use only when Row Level Security is configured correctly.
- Do not treat a hidden admin button or a frontend check as security. Protect data with RLS and server-side checks.
- Review the SQL policies and test them with non-admin accounts before using real user data.
