# Airgas Cylinder Issue Tracker: Roadmap

Design source: `design/` (from the Claude Design handoff; kept on this computer only and left out of git
because it has real staff names). The original reference is `Cylinder Issue Tracker v2.dc.html`, and
`design/README.md` is the original spec. The workflow has since changed in places (see "Changes from the
original design" below); this file describes what is built.

*Last updated Nov 18, 2026. Phases 0–3 are done and the system has been tested end to end with real email.*

## Hosting: GitHub only

Rice can only host on GitHub, so the whole system runs on GitHub. There is no separate server.

| Piece | Runs on | Job |
|---|---|---|
| Website (form + admin dashboard) | **GitHub Pages**, public repo `cb156rice/cylinder-tracker` | Static React app. Holds no data. |
| Database | **GitHub Issues**, private repo `cb156rice/cylinder-tracker-data` | Each ticket is an issue; each timeline entry is a comment. |
| Tracker mailbox | Gmail `cylindertracker1@gmail.com` for the demo, a Rice mailbox later | Everything to or from Airgas and reporters goes through it. |
| Backend job | **GitHub Actions** in the private repo (`.github/workflows/mail.yml`) | Reads mail, takes timed steps, sends mail. |
| Form email | **EmailJS** | Lets the public form send email without a server. |

## How a ticket moves

1. **Report.** A lab member submits the form. EmailJS emails it to the tracker mailbox.
2. **Mail job** (every 15 min on weekdays 7 AM–6 PM, hourly otherwise, or right away with **Check mail now**):
   reads the inbox and creates issue `RG-####`.
3. **Opening email** to Ruben and Gordan at Airgas. The building lead (SST → Israel, O'Connor → Robert,
   other → Javier), **Javier (always)** and the reporter are copied.
4. **Airgas replies all.** The reply lands on the ticket (matched by `[RG-####]` in the subject, quoted text
   stripped, sender picked from the address and sign-off). Airgas's **first reply moves the ticket to
   In progress** by itself. A date in a reply ("tomorrow", "Friday", "Nov 20") becomes the expected date;
   the lead can ignore it if it was read wrong.
5. **Due dates.** Airgas has 12 business hours to reply. The fix is due at 5 PM on the date Airgas gave,
   or 2 business days after the report if they never gave one. Late tickets are marked **Late**.
6. **No reply.** After 12 business hours with no reply, the tracker **follows up** on the thread.
   If 12 more business hours pass with no reply, the ticket gets a **warning sign** and moves to the top of
   the queue; the lead can escalate to Chris.
7. **"Is it fixed?"** The morning after the fix due date, the reporter gets an email with **Yes / No**
   buttons (or they reply YES or NO). YES closes the ticket. NO reopens it, passes their comment to Airgas
   on the thread and waits for a new date.
8. **Rice can step in any time:** reply on the thread from the dashboard (sent by the next mail job), press
   **Mark fixed**, or under More options escalate to Chris or write down a call or visit.

Business hours are 9 AM–5 PM, Monday–Friday, Houston time.

### Changes from the original design

| Original design | Built | Why |
|---|---|---|
| Replies appear instantly | Within about 15 min, or ~1 min with **Check mail now** | Scheduled Actions only; no server |
| Form shows the ticket ID right away | "You'll get an email with your ticket number" | The public form can't write to the private repo |
| Coordinator sets status and complexity (Low/Medium/High) | Airgas's first reply sets In progress; no sizes; due date = Airgas's date or 2 business days | Rice usually can't act on these issues; Airgas drives them |
| Javier emailed only on escalation | Javier copied on every email | Decided Nov 18 |
| Delivery schedule matching, "Today's deliveries" tab, 4 PM confirmation | Removed; replaced by the "Is it fixed?" check after the due date | Airgas runs its own deliveries; also catches quiet fixes |
| Visit agenda and driver stop sheet printouts | Removed | Airgas controls visits and driver routes |
| One-click signed Yes/No links | Yes/No **mailto** buttons that open a reply with YES or NO | Signed links need a server; the poller already reads replies |
| Rice SSO admin login | GitHub token pasted into the dashboard once | No server to handle SSO |
| "Draft with Claude" | "Write it for me" fills a simple template (Claude is Phase 4) | Needs an Anthropic API key |

---

## Phase 0: Setup ✅ Nov 4, 2026

- [x] Two repos: public `cb156rice/cylinder-tracker` (site), private `cb156rice/cylinder-tracker-data` (data + mail job)
- [x] Gmail `cylindertracker1@gmail.com` through the **Gmail API with an OAuth refresh token** (Google Cloud project
      `cylinder-tracker`, Desktop client, scope `gmail.modify`; the app must stay "In production" or the token expires in 7 days)
- [x] EmailJS service and template; the "To" address is fixed in the template
- [x] Secrets in the data repo: `GMAIL_ADDRESS`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`
- [x] Site deploys to https://cb156rice.github.io/cylinder-tracker/ on every push to `main`

## Phase 1: Front end with sample data ✅ Nov 4, 2026

- [x] Vite + React + TypeScript; business rules in `src/lib/` with unit tests
- [x] Public report form; admin queue (To do / Late / Completed / All), ticket panel, email timeline
- [x] All data behind one `TicketStore` interface (browser demo store or GitHub store)

## Phase 2: GitHub Issues as the database ✅ Nov 13, 2026

- [x] `GitHubStore`: tickets as issues, timeline entries as append-only comments, labels for filtering
- [x] Connect dialog (fine-grained token saved in the browser), refresh every 45 s
- [x] Tested live: sample import, edits, two browsers

## Phase 3: Real email, the boss demo ✅ Nov 18, 2026

- [x] Form → EmailJS → tracker mailbox
- [x] Mail poller: new tickets, reply matching, quoted-text stripping, sender detection, YES/NO answers
- [x] Mailer: opening emails, dashboard replies, follow-ups, check-ins; threaded (`In-Reply-To`/`References`);
      HTML + plain text from one set of templates (`src/lib/emails.ts`)
- [x] Timed steps in the same job: 12-hour follow-up, "Is it fixed?" check-in (real form tickets only)
- [x] **Demo mode:** Airgas people → `AIRGAS_ADDRESSES`, Rice staff and reporters → `STAFF_ADDRESSES`
      (data repo variables); every email starts with who it would really go to. Real Airgas staff are never emailed.
- [x] Dashboard redesign: one next step per ticket, due dates instead of timers, color only for Late,
      warning sign for no reply after follow-up
- [x] **Users and Settings pages:** people (name, title, email, GitHub username), building leads, who gets new
      tickets, who is always copied, escalation contact, close on YES. Stored as one closed settings issue in the
      data repo (`src/lib/directory.ts`, `githubFormat.ts`); the mail job loads it at the start of each run.
- [x] **Check mail now** button (LIVE bar). The dashboard token needs **Actions: Read and write** in addition to
      **Issues: Read and write**.

Tested end to end with real mail on Nov 18 (RG-1010): report → opening email → Airgas reply-all → moved to
In progress with a date → dashboard reply → "Is it fixed?" → YES → closed.

## Phase 4: Claude (optional, needs an Anthropic API key)

- [ ] Save `ANTHROPIC_API_KEY` in the data repo's Actions secrets
- [ ] "Write it for me" drafts with Claude as an Action (prompts in `draftPrompt()` in `src/lib/draft.ts`);
      drafts are never sent until someone presses Send
- [ ] Claude reads dates out of replies (replaces the pattern matching in `src/lib/eta.ts`)

## Phase 5: Going live at Rice

Questions for Rice IT and the stockroom:

- [ ] **Mailbox:** can we have `cylinder-issues@rice.edu`? Rice's Microsoft 365 likely needs an app
      registration (Microsoft Graph) instead of the Gmail API. Otherwise, keep a dedicated Gmail.
- [ ] **Data:** is storing reporter names and emails in a private GitHub repo allowed?
- [ ] **GitHub account:** who owns the repos long term (a Rice GitHub organization, not a student account)?
- [ ] Open questions: should a reporter's YES close the ticket or wait for the lead (`autoCloseOnConfirm`,
      now on)? Should Rice holidays pause the clock? Which other buildings get cylinders, and who coordinates them?
- [ ] FAQ and install guide content for the public form (from Robert)
- [ ] Login page for the admin view: check the signed-in GitHub username against the Users page (real access control is
      GitHub repo access; the login page decides what the dashboard shows)
- [ ] Turn off demo mode: fill in real addresses on the Users page, then make the mailer send to them and to reporters

## Known limits of the GitHub-only setup

- Replies and new reports show up within minutes, not seconds (or about a minute with Check mail now).
- Admins need GitHub accounts and a token. Tokens expire: the push token around **Feb 2, 2027**, the
  dashboard token 90 days after it was made.
- GitHub Actions minutes are limited on private repos (2,000/month free). Each run bills at least 1 minute;
  the current schedule is about 1,600 runs a month, so there is little room to run it more often.
- If Rice ever approves a real server, the front end and business rules carry over;
  only the Actions and the `GitHubStore` get replaced.
