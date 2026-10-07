# InKognito launch runbook

Everything still to do before inkognito.co.il goes live, in order. Each step says who does it.
"Owner" steps are dashboard clicks; Claude can guide each one live. Written 4 October 2026 on
branch `inkognito`, from the build plus three research reports (Cloudflare Pages, email with
Resend, Israeli law) and an independent security review.

**Already done** (by 5.10):
- **The Supabase project** (Frankfurt). Migrations 0001–0010 are all live and verified.
  - 0009 (5.10): a byte budget for logs, names only from Google, profiles only once confirmed.
  - 0010 (5.10): the keep-awake request.
  - 0006 (5.10): the daily sign-ups email. A test was sent.
- **Sign-in** with Google, or with an email and a password.
- **The rest of the build:** the gate, the hosted build (`dist/`), the admin page and the legal
  pages.
- **The site runs on inkognito.co.il**, with www redirected to it (5.4). It is kept out of search
  engines until launch (7).
- **Email:** it goes out through Resend from contact@inkognito.co.il (4.1). The templates were
  pasted in their final versions on 5.10.
- **Google sign-in** is open to every account (6).
- **The tool speaks to its users in the plural** (v59, public tool and hosted alike).

**Left:**
- The owner's full test on the live site (sign-up, confirmation, reset, Google, a document, the
  admin page).
- Then launch day (7): `LAUNCHED = true`, Search Console, and the move from the GitHub Pages
  address.
- Deferred by the owner on 5.10 ("not for now"): Resend's paid plan (4.2), Supabase Pro (7), and
  a custom domain for Google's sign-in screen (6). Revisit them when users arrive.

---

## 0. Two-step sign-in on every account (owner; done 4.10)

Supabase, Cloudflare, Google (the account that owns the OAuth client), Resend (once created),
GitHub, MyNames. Israel's data-security regulations ask for adequate sign-in protection even at
the lightest level, and these accounts control the whole service.

## 1. The domain on Cloudflare (owner; waits for the registry)

1. Wait for Cloudflare's email: **inkognito.co.il is Active**. (If not by the evening after the
   change, ask MyNames whether the nameserver change to `ada` and `tim` reached the registry.)
2. **DNS → Records:** there should be no A, AAAA or CNAME for `inkognito.co.il` or `www` (the
   site's records are added by Pages in step 5). Keep any MX and TXT.
3. **Turn these off** (each would inject scripts our pages' security policy blocks, or send data
   to Cloudflare's analytics):
   - **Scrape Shield → Email Address Obfuscation: OFF.** It rewrites the `mailto:` links on the
     legal pages, and under our policy they would break.
   - **Web Analytics** (Analytics & Logs → Web Analytics, or Speed → Observatory → RUM):
     **disable** for the site. On free plans it can switch itself on, outside the EU.
     (4.10: its script did appear once the domain was attached, and the setting was not where
     these menus say. The pages now carry `no-transform`, which keeps Cloudflare's scripts out
     whatever the setting; checked live.)
   - Bot Fight Mode and Rocket Loader: leave **off** (the defaults).
   - **Browser Cache TTL.** The zone's default (4 hours) replaces the site's own "check again every
     time" on the public scripts (config.js, login.js, cloud.js…), so after a deploy a browser
     could run a new page with an old script. The owner's dashboard did not offer "Respect
     Existing Headers" (5.10), so it is solved in the build instead (386ecc3). Every page names its
     public scripts and styles with a content hash (`config.js?v=a5ade2eb53`), so a new page always
     loads its own version. The tool's files under /app/ are `private`, which Cloudflare leaves
     alone.
4. **DMARC:** DNS → Add record → TXT, name `_dmarc`, value
   `v=DMARC1; p=none; rua=mailto:contact@inkognito.co.il`. (Or Email → DMARC Management.)
   Tighten to `quarantine` later, once reports are clean.

## 2. contact@inkognito.co.il → your Gmail (owner, 5 minutes)

Cloudflare → Email → Email Routing → **Onboard domain** → accept the records it adds (three MX
on the root, an SPF TXT, a DKIM TXT). Destination addresses → add your Gmail → click the link in
the email Cloudflare sends. Routing rules → custom address `contact` → send to that Gmail.
Test from a different account.

Replying *as* contact@ from Gmail ("Send mail as") is being retired by Google for outside
addresses (January 2027, maybe refused for new setups already). For now, reply from your own
Gmail; decide later between a mail program that sends through Resend, or Google Workspace.

## 3. Resend, the sender of sign-in emails (owner, 15 minutes)

1. Sign up at resend.com, turn on two-step sign-in.
2. Domains → **Add domain → `inkognito.co.il`** (the root, so the sender is
   `noreply@inkognito.co.il`). Region: **Ireland (eu-west-1)**. Note: Resend stores its data
   (logs, the emails for 30 days) in the US whatever the region; the privacy page already says so.
3. DNS: click **Sign in to Cloudflare** to add the records automatically. Leave **Receiving
   OFF** (it would clash with Email Routing's MX). If adding by hand: names only (`send`,
   `resend._domainkey`), and any CNAME set to **DNS only** (grey cloud).
4. **Verify**. Usually minutes.
5. API Keys → create **two** keys, each **Sending access**, restricted to `inkognito.co.il`:
   one named `supabase`, one named `digest`. Each is shown once: paste it straight where it goes
   (steps 4.1 and 4.4), never into a chat.
6. Leave click and open tracking **off** (the default): tracking rewrites sign-in links.

## 4. Supabase (owner, 15 minutes; https://supabase.com/dashboard/project/cwsiranjlxbclmaqtucc)

1. **Authentication → Emails → SMTP Settings → Enable custom SMTP:**
   sender email `contact@inkognito.co.il` (switched from noreply@ on 5.10, so that a reply reaches
   the owner), sender name `InKognito`, host `smtp.resend.com`, port `465`, username `resend`,
   password = the `supabase` key. Save.
   (A Hebrew sender name, אינקוגניטו, may work; test it once before switching.)
2. **Authentication → Emails → Templates** (unlocked by step 1). Each body is a file in
   `supabase/templates/`, from its `<!DOCTYPE html>` line to the end, copied in an editor (never a
   terminal: it reverses Hebrew) and pasted into the Source view. Save each. Then leave them alone
   for weeks: Supabase advises changing sign-in emails rarely and all at once, while a new domain
   earns Gmail's trust (deliverability review 4.10; tests/mail_t.js holds what it settled).
   - **Confirm signup**: subject `אימות כתובת המייל לאינקוגניטו`, body `confirm-signup.html`.
   - **Reset Password**: subject `איפוס סיסמה לאינקוגניטו`, body `reset-password.html`.
   - **Change Email Address**: subject `אימות שינוי כתובת המייל לאינקוגניטו`, body `change-email.html` (from 0011; the link goes to both addresses).
   - **Magic Link**: subject `קישור כניסה לאינקוגניטו`, body `magic-link.html`. The sign-in page
     never asks for one (sign-in is Google, or an email and a password, 4.10); only the
     dashboard's "Send magic link" sends it, so its words do not assume the recipient asked.
   Then **Authentication → Sign In / Providers → Email**: minimum password length **8**, password
   requirements **none** (a "letters and digits" rule counts only English letters, so it would
   refuse a Hebrew password; length is what matters).
   Then **Authentication → Rate Limits → emails per hour**: raised to 100 for the whole site
   (done 4.10); every sign-up, resend and password reset counts. Resend's free plan also has a
   daily cap, and the sign-in page says so plainly when either cap is reached. **Move Resend to a
   paid plan before announcing** to more than a small circle (deferred by the owner, 5.10). The
   numbers are in `../inkognito-private/limits.md`.
   The templates were pasted again in their final versions on 5.10.
3. **Authentication → URL Configuration** (done 4.10 with step 5.3, once https://inkognito.co.il/login
   opened; the pages.dev entry then deleted, so that no email can carry a pages.dev link again):
   Site URL `https://inkognito.co.il/login`, with `/login`: when a request names no return page
   (an email sent from the dashboard) or names one not on the list, Supabase sends the person to
   the Site URL, and the sign-in page is the one that reads the link. (The landing page passes
   such a link on as well.) Redirect URLs: add `https://inkognito.co.il/login` and
   `https://inkognito.co.il/login.html`. (Cloudflare serves `login.html` as `/login`, so the page
   asks Supabase to return to `/login`. Supabase accepts any path on the Site URL's host anyway.)
   Keep the 127.0.0.1 and localhost entries for testing.
4. **The daily sign-ups email** (done 5.10): the owner put the two secrets in Vault
   (`resend_digest_key`, the `digest` key from Resend, and `digest_to`). Claude enabled **pg_net**
   and applied `supabase/migrations/0006_signup_digest.sql`, and sent a test that Resend accepted.
   The email carries only the number of new sign-ups and a link to the admin page, at 08:00 Israel
   time on days after a sign-up. To redo it on a new project (with your values):
   ```sql
   select vault.create_secret('<the digest key from Resend>', 'resend_digest_key');
   select vault.create_secret('<your email address>', 'digest_to');
   ```
5. Check (already so): Authentication → Sign In / Providers → **anonymous sign-ins OFF**;
   Email → **Confirm email ON**, **Secure email change ON**, email OTP expiration **900** (the
   confirmation and password links last 15 minutes; the sign-in page sends a new one).
6. **Adding someone by hand** (Authentication → Users → Add user → Create new user): the password
   typed there is dropped the moment the address is confirmed, "Auto Confirm" included. Supabase
   confirms such an account with an update, and 0008 drops any password set before that update.
   The person then signs in with Google, or sets a password with "forgot password".

## 5. Cloudflare Pages: put the site live (owner with Claude; done 4.10 except `www`, step 4)

From the repository folder, on branch `inkognito`:

```
npm install
npm run build:hosted
npx wrangler login
npx wrangler pages project create inkognito --production-branch=main
npx wrangler pages deploy dist --project-name=inkognito --branch=main
```

(`functions/` is picked up from the current folder. Cloudflare gave the project the address
`inkognito-4f1.pages.dev`, which can never change.)

1. Pages project → Settings → **Runtime → Fail closed.** Important: when the free plan's daily
   function requests run out, the default "fail open" serves the app's files *without the gate*.
   Fail closed shows an error page instead.
2. Test on `https://inkognito-4f1.pages.dev` (Claude runs these): the landing page, `/login`,
   sign in, the app opens, the admin page, and the gate probes:
   `curl -si https://inkognito-4f1.pages.dev/app/` → 302 to `/login.html`, and the same for
   `/app%2Fsupport.js`, `/%61pp/support.js`, `//app/support.js`, `/APP/support.js`,
   `/fonts/..%2Fapp%2Fsupport.js`. Anything that returns 200 is a stop.
3. Pages → Custom domains → **Set up a domain → `inkognito.co.il`**. Wait for Active.
   (Done early, 4.10, before the launch: the first sign-in emails went to Gmail spam with
   SPF, DKIM and DMARC all passing. A day-old domain with no website, and links to pages.dev. On
   the real domain the links match the sender. Until launch the build keeps it out of search
   engines: `LAUNCHED = false` in scripts/build-hosted.js. Supabase URL Configuration, step 4.3,
   goes with it.)
4. `www` (done 5.10): a **Bulk Redirect** (www.inkognito.co.il → https://inkognito.co.il, 301,
   keeping path and query) plus a proxied DNS record `A www 192.0.2.1`. www is not attached to
   Pages. Checked live: `https://www.inkognito.co.il/privacy?x=1` and `http://www…/login` answer
   301 to the same path on https://inkognito.co.il.
5. Repeat the checks on `https://inkognito.co.il`, and view the source of `/privacy` to confirm
   nothing was injected (no `email-decode`, no `beacon.min.js`). Every public script and style the
   pages name carries `?v=` and its content hash (1.3), and each of those addresses answers 200.

## 6. Google sign-in for everyone (owner; done 5.10)

Google Cloud → Google Auth Platform → **Branding:** homepage `https://inkognito.co.il`, privacy
policy `https://inkognito.co.il/privacy`, authorized domain `inkognito.co.il` (if Google asks
you to prove ownership, it gives a TXT record to add in Cloudflare DNS). No logo (a logo means a
review of weeks). Then **Audience → Publish app**. Done 5.10: In production, and tested with an
account that was not a test user.

Only the basic scopes (openid, email, profile), so publishing needs no review. But until Google
verifies the brand, its sign-in screen names the app by the address Google returns to:
"continue to cwsiranjlxbclmaqtucc.supabase.co" (Supabase's docs: "does not inspire trust").
Brand verification alone gets stuck on that address (Google's checker sees supabase.co, not the
homepage's name). The fix is a Supabase custom domain, e.g. `auth.inkognito.co.il` (a paid add-on
on the Pro plan), then brand verification. Decide before announcing widely: lawyers will see that
address on the Google screen.

Checked 5.10:
- **Cost:** Pro is $25 a month, and the custom domain $10 a month more (supabase.com/pricing).
- **Before verification:** Google names an unverified app by the address it returns to. With the
  custom domain, the screen says `inkognito.co.il` as soon as the domain is set up. Brand
  verification can then make it say the app's name.
- **Our own sign-in flow on inkognito.co.il would avoid the cost, but isn't worth it.** Google
  discourages the browser-only way (the "implicit flow"). The other ways either load Google's
  script on the sign-in page, or need a server that holds the Google client secret.

## 7. Before announcing (owner + Claude)

- Settled on 4.10: the courts clause (the competent courts in Israel, not exclusive), a narrow
  liability clause (no indirect damage, direct capped at ₪100 while free), the usage log only
  with active consent (asked when the first document is sent), the daily email as a count.
- Left for the lawyer: whether the accessibility rules apply at all (small-business exemptions),
  and the transfer basis for the US processors.
- The database definitions document (מסמך הגדרות מאגר): drafted for you outside the repository
  (`../inkognito-private/database-definitions.he.md`); keep it, and review it every year by
  31 December.
- Search engines (done 4.10): the home, privacy, terms and accessibility pages are indexable
  under their inkognito.co.il addresses (canonical links, sitemap.xml); the tool, admin, sign-in
  and 404 pages, and every pages.dev copy, are kept out. **On launch day, Claude sets
  `LAUNCHED = true` in scripts/build-hosted.js, builds and deploys**: until then the whole
  domain sends `X-Robots-Tag: noindex`. After launch, add the site in Google Search Console and
  submit `https://inkognito.co.il/sitemap.xml`. (The three step screenshots
  show no product name or version, so the rename needs no new ones.)
- Her move from the GitHub Pages address, at a time agreed with her.
- **Supabase Pro** ($25 a month) matters beyond Google's screen: the free plan keeps no backups,
  and Pro also turns on leaked-password protection (8). Deferred by the owner (5.10). A free
  project also pauses after a quiet week, and sign-in and the tool would stop until it is
  restored in the dashboard. So since 5.10 the database asks its own API one tiny question every
  four hours (0010, `public.ping()` with the site's public key). If that ever stops, Supabase
  still emails the owner a week before it pauses.
- From the night review (5.10), decided by the owner on 5.10:
  - **The site's code on GitHub:** publish the `inkognito` branch, after a scan for anything
    private (done: nothing secret or personal; the scan's small points are fixed in this file).
  - **Mail to contact@ is kept 12 months** (privacy page, section 6). Once a month, in Gmail:
    `to:contact@inkognito.co.il older_than:1y`, select all, delete.
  - **The tool speaks to its users in the plural** (v59, PR #77; tests/address_t.js keeps it so).
    The site's own pages were already neutral.
- **One database migration: applied 5.10.** Three findings from the night review, each low on
  its own:
  - **Storage has no byte budget.** One account may store about 39 MB of logs a day (100 logs of up
    to 384 KB). The free plan's 500 MB would then fill in about 13 days, and the database goes
    read-only. The fix: one size cap per call, a daily byte budget per account, and a daily cap
    across all accounts.
  - **The first person to register an address sets its name for good.** A stranger can sign up
    with someone's address and a made-up name. The real owner keeps that name in their account
    panel and on the admin page. The fix: take the name only from Google's identity.
  - **Unconfirmed sign-ups count as users.** An address that was never confirmed shows on the
    admin page as "active" and counts in the totals and the daily email. The fix: create the
    profile when the address is confirmed.

  Written as `supabase/migrations/0009_budget_names_confirmed.sql` (5.10), with an account's logs
  capped at 250 KB a day and the service's at 700 KB, and what its two reviews added: sign-up
  metadata over 4 KB is emptied, sign-ups never confirmed are deleted after 7 days (privacy page,
  section 6), and a Google identity that did not vouch for an address goes when the address is
  confirmed.
  Applied 5.10 by Claude:
  - **The preflight first** (counts only): nothing to stop on, both privileges present, no
    profile to remove and no name to change, 2 Google identities that both vouched, 3 accounts,
    0 logs, the database 11 MB.
  - **Then 0009 in one go.** Its 13 functions match the repository's byte for byte.
  - **Then the live checks.** `budget_names_smoke.sql`, confirm, consent, delete, hardening,
    retention and smoke each printed its expected line and left nothing behind. privileges.sql
    shows the 13. The security advisor shows nothing new.
  - **Still to do:** one real email sign-up and one real Google sign-up, in the owner's full test.
  If a sign-up or a confirmation fails afterwards, `supabase/rollback/0009_restore_signups.sql`
  makes them work again at once; `supabase/rollback/0009_full.sql` goes back to 0008.

## 8. Later, when it grows

- Done 5.10 (80de769): the admin page reads every user and every log page by page, in a fixed
  order, up to the count the database gives. It no longer stops silently at Supabase's
  1,000-row page.
- The tool's page (337 KB) goes out uncompressed. `no-transform`, which keeps Cloudflare's
  scripts out, also stops Cloudflare compressing it; gzipped it is about 94 KB. The gate can
  compress it itself (`content-encoding: gzip`). Check it live with a session.

- At 10,000 users the data-security level rises from "managed by an individual" to "basic":
  a written security procedure, access management, and processor terms.
- On Supabase's paid plan: Authentication → Email → **Prevent use of leaked passwords**
  (HaveIBeenPwned). The security advisor lists it as off; the free plan cannot turn it on.
- Supabase's performance advisor (5.10): two policies call `auth.uid()` once per row (`own
  profile` on profiles, `anyone signed in reads settings` on app_settings), and four call
  `is_admin()` the same way (`own profile` and the owner's three; on the log download, once per
  log). Write them as `(select auth.uid())` and `(select public.is_admin())` in a migration once
  there are many users; at a few hundred it makes no difference. (Left out of 0009: changing a
  policy locks its table against every reader, the gate's included, for the migration's moment.)
- **Logs refused (0009).** If logs stop arriving and Supabase's API logs show 429 on `submit_log`,
  see who used the last 24 hours (SQL editor):
  `select user_id, count(*), sum(pg_column_size(log) + coalesce(pg_column_size(leaks), 0) + 256) from public.usage_logs where created_at > now() - interval '1 day' group by 1 order by 3 desc;`
  Blocking an account on the admin page gives its share of the service's day back at once; its
  logs go with `delete from public.usage_logs where user_id = '<id>';`. On Pro (8 GB), the two
  numbers in `private.log_limit` can be ten times larger and still leave room.
- **Refused logs are not counted** (review of 0009). An account that said yes to the log can send
  logs that fail the shape check as fast as it likes, each costing the server up to a few tenths
  of a second; the limits count only stored logs. If the site slows down and the API logs show
  many `submit_log` 400s from one account, block it. A later migration can count refusals.
- **Sign-in sessions** stay until sign-out on the free plan, one per sign-in (the preflight of 0009
  shows their table's size). On Pro: Authentication → Sessions, a time-box.
- Before charging: open the tax files; the consumer-law identity details (name, ID, address)
  and the 14-day cancellation right may apply; marketing emails need opt-in and the word
  "פרסומת".
