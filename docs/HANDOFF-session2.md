# Session handoff: Cylinder Tracker (session 2)

Last updated: Wed Nov 4, 2026 (end of session). Point a new Claude session at this file to pick up where we left off.
It replaces [HANDOFF-session1.md](HANDOFF-session1.md), which is kept for history.

## What this is

A web tool for the Rice University stockroom to track problems with Airgas gas cylinders
(leaks, missed deliveries, empty cylinders). It has two parts:

- **Public report form:** labs report an issue.
- **Admin dashboard:** for Israel (SST), Robert (O'Connor) and Javier (supervisor). Each ticket is an email thread
  with Airgas (Ruben, Gordan; Chris on escalation). Airgas never logs in; they just reply all.

**Goal right now:** a demo to show Carlos's boss. **Constraint:** Rice can only host on GitHub, so there's no server.

The full spec is `design/README.md`. The visual and logic reference is `design/Cylinder Issue Tracker v2.dc.html`.
The plan is in [ROADMAP.md](ROADMAP.md).

## Architecture (decided, unchanged)

| Piece | Where |
|---|---|
| Website (form + dashboard) | GitHub Pages, public repo **cb156rice/cylinder-tracker** → https://cb156rice.github.io/cylinder-tracker/ |
| Database | GitHub Issues in private repo **cb156rice/cylinder-tracker-data** (1 ticket = 1 issue) |
| Backend jobs | GitHub Actions in the private repo: mail poller, mailer, deadline check, Claude drafts |
| Tracker mailbox | `cylindertracker1@gmail.com`, through the **Gmail API** (OAuth refresh token) |
| Form → mailbox | **EmailJS** (browser-side email; "To" is fixed in the template) |
| Admin login | A GitHub fine-grained token pasted into the dashboard once |

On-purpose changes from the design: replies arrive in about 10–15 min (plus a "Check mail now" button); the form says
"ticket number coming by email"; the delivery confirmation asks people to **reply YES or NO** (no links);
Claude drafts take 30–60 s. **Demo mode rule:** every outgoing email goes to Carlos's personal address with a
"Would go to: …" line; real Airgas staff are never emailed from the demo. **Actions minutes:** 2,000/month free on
private repos, each run counts as at least 1 minute: run the poller and deadline check as one job, every 10 min in
business hours and hourly otherwise.

## Done

**Phase 0** (session 1): scaffold, Pages deploy workflow, EmailJS template, Google Cloud/Gmail OAuth, secrets in
cylinder-tracker-data, `public/privacy.html`, `scripts/get-gmail-token.mjs`. EmailJS: the app must send `payload`
as **base64-encoded JSON** of the full report.

**Phase 1** (session 2): every screen works with demo data in the browser. **Pushed and live** on Pages
(deploy run succeeded for commit `7a535c9`).

| Area | Files |
|---|---|
| Business rules (pure, tested) | `src/lib/`: `time.ts` (Chicago business hours: `bizMs`, `addBiz`, `subBiz`, day keys, formatting), `rules.ts` (routing, clocks, deadlines, thread state, agenda/driver rules), `eta.ts`, `transitions.ts` (every ticket change), `deliveries.ts` (schedule matching), `draft.ts` (template drafts + the Claude prompts for Phase 4), `types.ts` |
| Storage | `src/store/store.ts` (`TicketStore` interface), `localStore.ts` (localStorage + Reset demo), `seed.ts` (prototype data), `hooks.ts` (`useStore`, `useTickets`, `useNow`, `useDemoStore`) |
| Screens | `src/report/ReportPage.tsx` (form), `src/admin/` (AdminPage, Queue, TicketPanel, Thread, Composer, Deliveries, HowItWorks, Printouts) |
| Routing | `src/router.ts`: `#/report`, `#/admin`, `#/admin/RG-1048`, `#/admin/RG-1045?ask=schedule`, `#/admin/deliveries`, `#/admin/how` |
| Settings | `src/config.ts`: EmailJS IDs, tracker address, data repo, `autoCloseOnConfirm` (open question; default true) |

Key decisions made this session:
- **Times:** instants are ISO strings; ETAs are Chicago calendar days (`'YYYY-MM-DD'`). All math uses
  America/Chicago regardless of machine time zone. `npm test` runs with `TZ=UTC`; tests also pass in Asia/Tokyo.
- **Seed data is rebased to the real clock:** each prototype timestamp keeps the same number of *business hours*
  before "now", and ETAs the same number of business days. Clocks match the prototype on any day. Three seed
  messages were reworded to avoid weekday names ("the next delivery day").
- **Ticket changes are pure functions** in `transitions.ts`; the store applies them with
  `store.update(id, (t, now) => …)`. Phase 2's GitHub store and the Actions jobs should reuse them.
- **Draft button** fills in a template (labelled "template until Claude is connected"). `draftPrompt()` already
  holds the prototype's system/user prompts for Phase 4.
- **Printouts** render in a modal and print via `@media print` (no pop-up window).
- **Form validation** also requires a building name when "Other building" is chosen (the prototype didn't).
- With a ticket open, the queue table hides its Coordinator column so it fits beside the panel.

**Phase 2, code done but not yet tried against real GitHub** (session 2, commit `0ad9e77`, **not pushed**):

| Piece | Files |
|---|---|
| Issue format | `src/store/githubFormat.ts`: issue #N = ticket `RG-(1000+N)`; title `[RG-1048] Leak · SST 312`; body = readable summary + ```json block of ticket fields (no id, no thread) inside `<details>`; **each thread entry is its own comment** starting with `<!-- cylinder-tracker:entry {json} -->` then readable text; labels `status:` `building:` `coordinator:`; completed tickets are closed issues. `FORMAT_VERSION = 1`. The Phase 3 Actions must use this same format. |
| API client | `src/store/githubApi.ts`: the few REST calls (list issues, repo-wide comments `since`, create/patch issue, labels, comments) with readable error messages |
| Store | `src/store/githubStore.ts`: refresh = list issues + comments since last sync (2 calls); `update` re-reads that one issue and its comments, applies the transition, posts new entries as comments, patches the body only if fields changed; `importTickets` loads the sample into an empty repo; `status()` for sync state/errors |
| Switching | `src/store/connection.ts`: token saved in localStorage → `GitHubStore`, otherwise `LocalStore`. `connect()` refuses a public repo. `src/TopBar.tsx`: DEMO/LIVE bar, Connect dialog, Refresh, Disconnect, error banner. Hooks refresh every 45 s and on tab focus. |

Phase 2 decisions:
- **Append-only comments** for the thread so concurrent writers (two admins, or an admin plus the mail poller) never
  clobber each other; only field changes rewrite the body, and they re-read the issue first.
- Ticket IDs come from issue numbers, so the poller and the dashboard can't create duplicate IDs.
- In live mode `schedule()` returns nothing (the schedule arrives by email in Phase 3), and "Demo: simulate Airgas
  reply" is hidden.
- The public form still writes to each visitor's own demo data unless that browser is connected (no token on the
  public site). Phase 3 switches the form to EmailJS.
- The "Viewing as" switch stays in live mode: for the demo Carlos plays all three roles.
- Labels are best-effort (a failure there doesn't block a save).

Testing: 68 unit tests, including the GitHub store against an in-memory fake of the API (two browsers, concurrent
edits, sample import, bad token). Earlier: 58 unit tests (`npm test`). Click-through flows were checked with a throwaway headless-Chrome script
(DevTools protocol via Node's built-in WebSocket); it isn't in the repo. Chrome is at
`/Applications/Google Chrome.app`, and `--headless=new --screenshot` works for quick visual checks
(minimum window width is about 500 px).

## Next

1. **Carlos makes a dashboard token** (separate from the push token, least privilege), signed in as **cb156rice**:
   https://github.com/settings/personal-access-tokens/new → name `cylinder-tracker dashboard`, 90 days,
   owner cb156rice, "Only select repositories" → `cylinder-tracker-data`, Repository permissions → **Issues: Read
   and write**. He pastes it into the dashboard's **Connect to GitHub** dialog (never into chat).
2. **First real test** on localhost (`npm run dev`, then http://localhost:5173/cylinder-tracker/#/admin): connect,
   **Load sample tickets**, check issues appear on github.com with labels and comments, change a ticket.
   Watch for: label creation with an Issues-only token (best-effort, may silently fail), CORS, rate limits,
   GitHub's secondary limit on creating content quickly during the sample import (~50 writes).
3. **Two-browser test** (Safari or a Chrome private window, same token): a change in one shows in the other within
   45 s. That's the Phase 2 "done when". Then tick the Phase 2 boxes in ROADMAP.md and have Carlos push.
4. Phase 3 (real email; **the boss demo**): EmailJS from the form, Gmail poller and mailer Actions in the data repo
   using `githubFormat.ts`'s format (consider moving the format + `src/lib` into code the Actions can import),
   "Check mail now" (needs Actions: write on the token), demo-mode redirect of all outgoing mail to Carlos.
5. Phase 4: deadline checks/follow-ups, Claude drafts (`draftPrompt()` is ready), delivery confirmation by reply.

## Gotchas

- **Two GitHub accounts on this Mac.** Keychain has a saved login for `zigotinho`. The remote URL includes the
  username (`https://cb156rice@github.com/cb156rice/cylinder-tracker.git`) so pushes use the cb156rice token.
  Clone `cylinder-tracker-data` the same way (`cb156rice@`).
- **Push token** is fine-grained (Contents + Workflows read/write, both repos), created Nov 4, 2026,
  **expires around Feb 2, 2027**. Without Workflows permission, pushes touching `.github/workflows/` fail.
- **No Homebrew and no `gh` CLI.** Claude can read public GitHub API data with `curl` but can't trigger runs.
- **Google OAuth app** must be "In production" (Google Auth Platform → Audience), or the refresh token expires
  after 7 days. Re-run `scripts/get-gmail-token.mjs` if it stops working.
- Deploy annotations about Node 20 (`deploy-pages@v4`) and `ubuntu-latest` are harmless for now.
- oxlint's react rule wants component files to export only components: hooks live in `store/hooks.ts`, the context
  object in `store/storeContext.ts`, display helpers in `admin/display.ts`.

## Still needed from people

- **Rice IT:** what "only GitHub" means; whether names/emails may live in a private GitHub repo; a Rice mailbox and
  GitHub organization long term.
- **Boss/stockroom:** open questions in `design/README.md` (schedule format, auto-close on YES, holidays, other
  buildings, RUPD/EHS number, FAQ and install guide content from Robert).
- **Carlos:** an Anthropic API key before Phase 4.

## Working preferences

- Carlos is new to most of this tooling and wants step-by-step instructions for anything done in a browser or Terminal.
- Carlos pushes to GitHub himself; Claude commits locally. Show the app running locally before pushing new screens.
- Never ask for or print secrets in the chat. They go straight into GitHub secrets.
- One handoff file per session (`docs/HANDOFF-session<N>.md`); write the next number rather than overwriting.
