# Session handoff: Cylinder Tracker (session 3)

Last updated: Wed Nov 18, 2026 (end of session). Point a new Claude session at this file to pick up where we left off.
It replaces [HANDOFF-session2.md](HANDOFF-session2.md), which is kept for history.

## Where things stand

**Phases 0–3 are done and ready for the boss demo.** The full loop was tested with real email on Nov 18 (RG-1010):
form → ticket → opening email to "Airgas" → reply-all → In progress with a date → reply from the dashboard →
"Is it fixed?" → YES → closed. [ROADMAP.md](ROADMAP.md) is up to date and describes the current workflow; read it first.

What's left: Phase 4 (Claude drafts and date reading, needs an Anthropic API key) and Phase 5 (Rice IT questions,
then turning off demo mode).

## What changed this session

- **Workflow (decided with Carlos):**
  - Opening email still goes to Airgas right away (no review step).
  - Airgas's first reply moves a ticket to In progress; complexity/sizes are gone (field kept in data, unused).
  - Fix due = 5 PM on Airgas's date, else 2 business days after the report (`fixDue` in `src/lib/rules.ts`).
  - Javier is copied on every email (`recipients`).
  - 12 business hours without a reply → automatic follow-up (`followUpDue`); 12 more → warning sign (`noReplyWarning`).
  - Morning after the due date → "Is it fixed?" to the reporter (`checkInDue`); YES closes, NO tells Airgas with
    the reporter's comment and waits for a new date.
  - Removed: deliveries tab and schedule matching, visit agenda and driver printouts, the "by phone" link.
- **Dashboard design:** one next step per ticket, due dates instead of countdowns, neutral colors (red only for
  Late), "More options" for escalate / call-or-visit / demo reply, warning banner and ⚠ in the queue.
- **Mail job** (`jobs/`): `poller.ts` (inbox → tickets, replies, YES/NO), `steps.ts` (follow-ups, check-ins; real
  form tickets only), `mailer.ts` (sends; multipart HTML + text). Entry point `main.ts`.
- **Email templates:** `src/lib/emails.ts`, one block model rendered as text (also shown on the timeline) and HTML.
  Check-in has Yes/No mailto buttons. Replies are recognized by "fixed?" in the subject.
- **Outbox rule** (`src/lib/outbox.ts`): an entry is sent when there's no `sent:<key>` note for it; only entries from
  the last 24 h are sent (old sample tickets never email).
- **Check mail now** button in the LIVE bar (`GitHubStore.checkMail`): starts `mail.yml` and waits for it.
- Data repo setup done by Claude with the `gh` CLI (installed via Homebrew this session): variables
  `AIRGAS_ADDRESSES`, `STAFF_ADDRESSES`; workflow `.github/workflows/mail.yml` (copy of `jobs/data-repo-workflow.yml`).

## To do before or at the demo

1. **Dashboard token needs Actions: Read and write** for Check mail now: github.com → Settings → Developer settings →
   Fine-grained tokens → `cylinder-tracker dashboard` → Repository permissions → Actions → Read and write → Update.
   No need to reconnect; the same token gets the new permission.
2. Optional: Watch → Ignore on the data repo, so GitHub's own notification emails stop.
3. Live data still has 8 sample tickets (RG-1001–1008) and two test tickets (RG-1009, RG-1010, both closed).
   Carlos chose to leave them.

## Gotchas

- **Two GitHub accounts on this Mac.** Keychain also has `zigotinho`; the remote URL includes `cb156rice@`.
  `gh` is logged in as cb156rice (token scopes include `workflow`).
- **The mail job runs the public repo's `main`.** Job changes only take effect after a push.
- Sample tickets were imported before some format changes; RG-1004's follow-up comment was edited by hand to add
  `"followUp": true`. Old "Javier notified" notes were removed.
- Running the job by hand: `gh workflow run mail.yml -R cb156rice/cylinder-tracker-data`, then
  `gh run watch` / `gh run view --log`.
- One-off scripts against live data: build with `npx vite build --ssr <file> --outDir <dir>` and run with
  `GITHUB_TOKEN=$(gh auth token) node …` (used to force a check-in on RG-1010).
- Headless Chrome screenshots: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless=new
  --screenshot=… --window-size=1440,1000 --virtual-time-budget=4000 <url>` (shows DEMO mode; LIVE needs a token).
- Actions minutes: ~1,600 runs/month on the current schedule vs 2,000 free.

## Working preferences

- Carlos is new to most of this tooling and wants step-by-step instructions for anything in a browser or Terminal.
- He wants the dashboard calm and simple: few buttons, plain words, no rainbow colors or countdown timers.
- Carlos usually pushes himself; this session he asked Claude to push. Ask before pushing unless told.
- Never ask for or print secrets in the chat.
- One handoff file per session (`docs/HANDOFF-session<N>.md`); write the next number rather than overwriting.
