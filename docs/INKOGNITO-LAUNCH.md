# InKognito launch runbook

Everything still to do before inkognito.co.il goes live, in order. Each step says who does it.
"Owner" steps are dashboard clicks; Claude can guide each one live. Written 4 October 2026 on
branch `inkognito`, from the build plus three research reports (Cloudflare Pages, email with
Resend, Israeli law) and an independent security review.

**Already done:** the Supabase project (Frankfurt, migrations 0001–0005 live and verified),
Google and email sign-in (tested), the sign-in page, the gate, the hosted build (`dist/`), the
admin page, the legal pages' content, the domain bought and pointed at Cloudflare (waiting for
the Israeli registry).

---

## 0. Two-step sign-in on every account (owner, 10 minutes)

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
   - Bot Fight Mode and Rocket Loader: leave **off** (the defaults).
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
   sender email `noreply@inkognito.co.il`, sender name `InKognito`, host `smtp.resend.com`,
   port `465`, username `resend`, password = the `supabase` key. Save.
   (A Hebrew sender name, אינקוגניטו, may work; test it once before switching.)
2. **Authentication → Emails → Templates** (unlocked by step 1). Each body is the contents of a
   file in `supabase/templates/`, copied in an editor (never a terminal: it reverses Hebrew) and
   pasted into the Source view. Save each.
   - **Confirm signup**: subject `אישור החשבון באינקוגניטו`, body `confirm-signup.html`.
   - **Reset Password**: subject `איפוס סיסמה לאינקוגניטו`, body `reset-password.html`.
   - **Magic Link**: subject `קישור כניסה לאינקוגניטו`, body `magic-link.html`. The sign-in page
     no longer asks for one (sign-in is Google, or an email and a password, 4.10), but the
     dashboard can still send it.
   Then **Authentication → Sign In / Providers → Email**: minimum password length **8**, password
   requirements **none** (a "letters and digits" rule counts only English letters, so it would
   refuse a Hebrew password; length is what matters).
3. **Authentication → URL Configuration** (on launch day, once the site is live):
   Site URL `https://inkognito.co.il`. Redirect URLs: add `https://inkognito.co.il/login` and
   `https://inkognito.co.il/login.html`. (Cloudflare serves `login.html` as `/login`, so the page
   asks Supabase to return to `/login`. With the Site URL on the same host, Supabase accepts any
   path there anyway.) Keep the 127.0.0.1 and localhost entries for testing.
4. **The daily sign-ups email** (optional, any time after step 3 of Resend):
   Database → Extensions → enable **pg_net**. Then SQL Editor, run (with your values):
   ```sql
   select vault.create_secret('<the digest key from Resend>', 'resend_digest_key');
   select vault.create_secret('<your email address>', 'digest_to');
   ```
   Then tell Claude to apply `supabase/migrations/0006_signup_digest.sql` and send a test. The
   email carries only the number of new sign-ups and a link to the admin page.
5. Check (already so): Authentication → Sign In / Providers → **anonymous sign-ins OFF**;
   Email → **Confirm email ON**, **Secure email change ON**, email OTP expiration **900** (the
   confirmation and password links last 15 minutes; the sign-in page sends a new one).

## 5. Cloudflare Pages: put the site live (owner with Claude, 30 minutes)

From the repository folder, on branch `inkognito`:

```
npm install
npm run build:hosted
npx wrangler login
npx wrangler pages project create inkognito --production-branch=main
npx wrangler pages deploy dist --project-name=inkognito --branch=main
```

(`functions/` is picked up from the current folder; the project name becomes
`inkognito.pages.dev` and can never change.)

1. Pages project → Settings → **Runtime → Fail closed.** Important: when the free plan's
   100,000 daily function requests run out, the default "fail open" serves the app's files
   *without the gate*. Fail closed shows an error page instead.
2. Test on `https://inkognito.pages.dev` (Claude runs these): the landing page, `/login`, sign
   in, the app opens, the admin page, and the gate probes:
   `curl -si https://inkognito.pages.dev/app/` → 302 to `/login.html`, and the same for
   `/app%2Fsupport.js`, `/%61pp/support.js`, `//app/support.js`, `/APP/support.js`,
   `/fonts/..%2Fapp%2Fsupport.js`. Anything that returns 200 is a stop.
3. Pages → Custom domains → **Set up a domain → `inkognito.co.il`**. Wait for Active.
4. `www`: Cloudflare's way is a **Bulk Redirect** (www.inkognito.co.il → https://inkognito.co.il,
   301, keep path and query) plus a proxied DNS record `A www 192.0.2.1`. Don't attach www to Pages.
5. Repeat the checks on `https://inkognito.co.il`, and view the source of `/privacy` to confirm
   nothing was injected (no `email-decode`, no `beacon.min.js`).

## 6. Google sign-in for everyone (owner, 10 minutes, after step 5)

Google Cloud → Google Auth Platform → **Branding:** homepage `https://inkognito.co.il`, privacy
policy `https://inkognito.co.il/privacy`, authorized domain `inkognito.co.il` (if Google asks
you to prove ownership, it gives a TXT record to add in Cloudflare DNS). No logo (a logo means a
review of weeks). Then **Audience → Publish app**.

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
  and 404 pages, and every pages.dev copy, are kept out. After launch, add the site in Google
  Search Console and submit `https://inkognito.co.il/sitemap.xml`. (The three step screenshots
  show no product name or version, so the rename needs no new ones.)
- Her move from the GitHub Pages address, at a time agreed with her.

## 8. Later, when it grows

- At 10,000 users the data-security level rises from "managed by an individual" to "basic":
  a written security procedure, access management, and processor terms.
- Before charging: open the tax files; the consumer-law identity details (name, ID, address)
  and the 14-day cancellation right may apply; marketing emails need opt-in and the word
  "פרסומת".
