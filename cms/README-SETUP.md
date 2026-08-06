# Kerehama Labs CMS — setup and how it works

A self-owned CMS at `/cms/` on this Netlify site. Clients sign in, edit their site
visually, manage SEO, and see traffic. Publishing commits the change to this repo
via the GitHub API; Netlify redeploys automatically (~1 min).

Nothing is tied to the current domain — every path is relative, so pointing a new
domain at this Netlify site changes nothing.

## One-time setup (do these in order)

The CMS uses its own dedicated Supabase project (the old chat-app project is retired).

1. **Create the project** — supabase.com -> New project (any name, e.g. `kerehama-labs-cms`,
   region Sydney). Wait for it to provision.

2. **Schema** — SQL Editor -> paste all of `cms/supabase-schema.sql` -> Run.
   Safe to re-run any time.

3. **Your admin account** — Authentication -> Users -> Add user:
   `kerehama@andrewstribe.co.nz` with a password, "Auto confirm" on. Then re-run the
   last statement of the schema file (it flags that user as admin).

4. **Recommended** — Authentication -> Sign In / Up: turn OFF "Allow new users to sign up"
   (accounts are created via the CMS invite flow, which uses the service key and is not affected).

5. **Point the CMS at it** — Project Settings -> Data API: copy the Project URL and the
   anon/publishable key into `cms/cms.js`. Copy the service_role/secret key into Netlify ->
   Environment variables as `CMS_SUPABASE_SERVICE_KEY`, and the Project URL as `CMS_SUPABASE_URL`.

6. **GitHub token** — github.com -> Settings -> Developer settings -> Fine-grained tokens:
   new token, Repository access = only `kerehama-labs`, Permissions = Contents: Read and write.
   Add it in Netlify as `GITHUB_TOKEN`. (Publishing and image upload return 500 until this exists.)

7. Optional: `RESEND_API_KEY` in Netlify for emailing login details to invited clients.

## Managing clients

- Sign in at `/cms/` as admin -> pick a site -> Admin tab.
- "Invite a client": creates their login, grants access to one site, shows you the
  password (optionally emails it to them). They can change it in Settings.
- "Add a site": registers a new slug so it can have members/drafts/analytics.
  The site's files still go in `sites/<slug>/` as usual.

## Making a site editable

1. Its content must be plain files in `sites/<slug>/` (no self-extracting bundles).
2. Tag editable text with `data-cms="some.key"` and images with `data-cms-img="some.key"`.
   The same key on several elements keeps them in sync (repeated CTA buttons etc.).
3. Add to the `<head>`: `<script defer src="/cms/site.js" data-site="<slug>"></script>`
   (this is also the analytics beacon).
4. `myspeech` is fully wired up as the reference example.

## Security model (do not weaken)

All client sites share one origin, so the publish pipeline never accepts raw HTML.
`cms-publish` applies a whitelist patch — text (HTML-escaped, `<br>` only), image srcs
(must be `assets/...` paths uploaded via `cms-upload`), SEO head tags — to the canonical
file from GitHub. Auth is a Supabase JWT checked server-side against site membership.
Analytics inserts happen only via the service role; clients can only read their own site's rows.

## Files

- `cms/index.html` — login + dashboard (Overview / SEO / Analytics / Settings / Admin)
- `cms/editor.html` — visual editor (iframes the live site with `?cms-edit=1`)
- `cms/edit-runtime.js` — injected into the site in edit mode only
- `cms/site.js` — per-site loader: pageview beacon + edit-mode bootstrap
- `cms/cms.js`, `cms/cms.css` — shared client + styles
- `netlify/lib/cms.mjs` — auth, GitHub commits, HTML patching (unit-tested)
- `netlify/functions/cms-{track,publish,upload,invite}.mjs` — the API
- `cms/supabase-schema.sql` — database schema + RLS
