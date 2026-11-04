# Session handoff: Cylinder Tracker

Last updated: Wed Nov 4, 2026. Paste or point a new Claude session at this file to pick up where we left off.

## What this is

A web tool for the Rice University stockroom to track problems with Airgas gas cylinders
(leaks, missed deliveries, empty cylinders). It has two parts:

- **Public report form:** labs report an issue.
- **Admin dashboard:** for Israel (SST), Robert (O'Connor) and Javier (supervisor). Each ticket is an email thread
  with Airgas (Ruben, Gordan; Chris on escalation). Airgas never logs in; they just reply all.

**Goal right now:** a demo to show Carlos's boss. **Constraint:** Rice can only host on GitHub, so there's no server.

The full spec is `design/README.md`. The main visual and logic reference is
`design/Cylinder Issue Tracker v2.dc.html`, which contains all the business rules in its `<script data-dc-script>`
block, from about line 595 on. The plan is in [ROADMAP.md](ROADMAP.md).

## Architecture (decided)

| Piece | Where |
|---|---|
| Website (form + dashboard) | GitHub Pages, public repo **cb156rice/cylinder-tracker** → https://cb156rice.github.io/cylinder-tracker/ |
| Database | GitHub Issues in private repo **cb156rice/cylinder-tracker-data** (1 ticket = 1 issue) |
| Backend jobs | GitHub Actions in the private repo: mail poller, mailer, deadline check, Claude drafts |
| Tracker mailbox | `cylindertracker1@gmail.com`, accessed through the **Gmail API** (OAuth refresh token) |
| Form → mailbox | **EmailJS** (browser-side email; "To" is fixed in the template) |
| Admin login | A GitHub fine-grained token pasted into the dashboard once |

Changes from the original design, all on purpose: replies arrive in about 10–15 min instead of instantly (plus a
"Check mail now" button); the form says "ticket number coming by email" instead of showing it right away; the
delivery confirmation asks people to reply YES or NO instead of clicking links; Claude drafts take 30–60 s.

**Demo mode rule:** every outgoing email goes to Carlos's personal address, with a "Would go to: …" line.
Real Airgas staff are never emailed from the demo.

**Actions minutes:** private repos get 2,000 free minutes a month, and each run counts as at least 1 minute.
Run the poller and the deadline check as one job, every 10 min during business hours and hourly otherwise.

## Done (Phase 0)

- [x] Project scaffold: Vite 8 + React 19 + TypeScript + Vitest, `base: '/cylinder-tracker/'`
- [x] `.github/workflows/deploy.yml`: test → build → deploy to Pages on push to `main`. Working and live.
- [x] `src/config.ts` holds the EmailJS IDs (service `service_lqvmtqg`, template `template_wfqbb2g`,
      public key `H1Q42aO8GCaKtk5Qn`), the tracker address and the data repo name. These are public values, not secrets.
- [x] EmailJS template: subject `[NEW REPORT] {{category}} · {{building}} {{room}}`, body wrapped in `<pre>`, fields
      name/email/phone/order/building/room/category/description, plus `{{payload}}` between `---DATA---` and `---END---`.
      **The app must send `payload` as base64-encoded JSON** of the full report, for the mail poller to parse.
- [x] Google Cloud project `cylinder-tracker`: Gmail API enabled, Desktop OAuth client, scope `gmail.modify`
- [x] Secrets in **cylinder-tracker-data** Actions secrets: `GMAIL_ADDRESS`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`,
      `GMAIL_REFRESH_TOKEN`
- [x] `public/privacy.html`, required by Google's sign-in screen
- [x] `scripts/get-gmail-token.mjs`: re-run it if the refresh token ever stops working

## Next: Phase 1 (screens and business rules with fake data)

Planned order:

1. **`src/lib/` business rules, ported from the prototype with unit tests.** Started but not saved, so begin here.
   - `time.ts`: `bizMs`, `addBiz`, `fmt`, `fmtShort`, `fmtDay`, `dur`, `sameDay`. **Must always use America/Chicago**,
     not the machine's time zone, because the Actions runners use UTC. Planned approach: convert each instant to Chicago
     "wall time" with `Intl.DateTimeFormat` (`formatToParts`), do calendar math with UTC getters, and convert back.
     A 9–5 window never contains a DST switch, so durations stay correct.
   - `types.ts`: `Ticket`, `ThreadEntry`, `EtaSuggestion` and related types (the data model is in `design/README.md`)
   - `rules.ts`: routing (SST→israel, O'Connor→robert, other→javier), deadline clocks (12 business hrs to respond;
     resolve in Low 12 / Medium 16 / High 40), visit-agenda "to discuss" rules, driver-sheet actions
   - `eta.ts`: `detectEta(text, now)`
   - Tests to include: Mon Oct 5 2026 2:30 PM + 12 business hrs = Wed Oct 7 10:30 AM. Fri Oct 30 4 PM CDT + 2 hrs =
     Mon Nov 2 10 AM CST (crosses the DST change). Run tests with `TZ=UTC` to prove the time zone handling works.
2. A `TicketStore` interface plus a local store (seed data from the prototype, saved in the browser, "Reset demo" button)
3. Report form (hash route `#/report`) in the design's styling: IBM Plex fonts, navy `#00205B`, tokens in `design/README.md`
4. Admin queue, ticket panel and thread timeline, then the deliveries tab, printouts and How it works tab
5. A "Demo mode" banner. Replace the Vite starter files (`src/App.tsx`, `App.css`, `assets/`) and set the page title.

Then Phase 2 (GitHub Issues store), Phase 3 (real email: **the boss demo**), Phase 4 (deadline checks, Claude,
delivery confirmation). See ROADMAP.md.

## Gotchas we hit

- **Two GitHub accounts on this Mac.** Keychain has a saved login for `zigotinho`. The remote URL includes the
  username (`https://cb156rice@github.com/cb156rice/cylinder-tracker.git`) so pushes use the cb156rice token.
  When cloning `cylinder-tracker-data`, use the same `cb156rice@` form.
- **Pushing** uses a fine-grained token (Contents + Workflows read/write, both repos, 90-day expiry, created
  Nov 4, 2026, so it **expires around Feb 2, 2027**). Without the Workflows permission, pushes that touch
  `.github/workflows/` fail.
- **No Homebrew and no `gh` CLI** on this Mac. Claude can read public GitHub API data with `curl`
  (run status, job steps, error annotations) but can't trigger runs.
- **Gmail app passwords weren't available** on the new account, which is why it uses OAuth instead.
- **Check the Google OAuth app's publishing status.** It must say "In production" in Google Cloud → Google Auth Platform →
  Audience. If it's still "Testing", the refresh token expires 7 days after it was created.
- Deploy annotations warn about Node 20 deprecation (`deploy-pages@v4`) and `ubuntu-latest` moving to Ubuntu 26.
  These are harmless for now; bump the action versions when convenient.
- `.Rhistory` in the project root is an empty, stray file. It's ignored by git.

## Still needed from people

- **Rice IT:** confirm what "only GitHub" means; whether names and emails may be stored in a private GitHub repo;
  a Rice mailbox and GitHub organization for the long term.
- **The boss/stockroom:** the open questions in `design/README.md` (daily schedule format, auto-close on YES,
  Rice holidays, other buildings, RUPD/EHS number, FAQ and install guide content from Robert).
- **Carlos:** an Anthropic API key before Phase 4.

## Working preferences

- Carlos is new to most of this tooling and wants step-by-step instructions for anything done in a browser or Terminal.
- Carlos pushes to GitHub himself; Claude commits locally. Show the app running locally before pushing new screens.
- Never ask for or print secrets (tokens, client secrets) in the chat. They go straight into GitHub secrets.
