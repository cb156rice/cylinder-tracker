# Airgas Cylinder Issue Tracker: Roadmap

Design source: `design/` (from the Claude Design handoff; kept on this computer only and left out of git
because it has real staff names). The main reference is
`Cylinder Issue Tracker v2.dc.html`, and `design/README.md` is the spec.

## Hosting: GitHub only

Rice can only host on GitHub, so the whole system runs on GitHub. There is no separate server.

| Piece | Runs on | Job |
|---|---|---|
| Website (form + admin dashboard) | **GitHub Pages**, public repo `cylinder-tracker` | Static React app. Holds no data. |
| Database | **GitHub Issues**, private repo `cylinder-tracker-data` | Each ticket is an issue. Thread messages, calls and status changes are comments and labels. |
| Tracker mailbox | Gmail for the demo (`rice-cylinder-demo@gmail.com`), Rice mailbox later | Everything going to or from Airgas goes through it. |
| Backend jobs | **GitHub Actions** in the private repo | Read mail, send mail, check deadlines, call Claude |
| Form email | **EmailJS** | Lets the public form send email without a server |

### How a ticket flows

1. A lab member submits the form. EmailJS emails the report to the tracker mailbox.
2. The **mail poller** Action (every 10 min in business hours, plus a "Check now" button) reads the mailbox and creates issue `RG-####`.
3. The **mailer** Action sends the opening email to Airgas, cc'ing the coordinator and the reporter.
4. Airgas replies all. The poller matches the reply by the `[RG-####]` tag and adds it as a comment.
5. Admins use the dashboard, which reads and writes the private repo through the GitHub API.

### Changes from the original design

| Original design | GitHub-only version | Why |
|---|---|---|
| Replies appear instantly | Within about 10–15 min, plus a "Check mail now" button | Scheduled Actions run every 5 min at most, sometimes late, and free minutes are limited |
| Form shows the ticket ID right away | "You'll get an email with your ticket number in a few minutes" | The public form can't write to the private repo |
| One-click "Yes/No" links in the confirmation email | "Reply YES or NO to this email" | Signed links need a server; the poller already reads replies |
| Rice SSO admin login | GitHub account with access to the private repo (token pasted in once) | No server to handle the SSO login |
| "Draft with Claude" is instant | About 30–60 s with a "Drafting…" state | The draft runs as an Action so the API key stays secret |
| Schedule ingestion service | Forward the daily schedule to the tracker mailbox | The poller parses it like any other email |

Everything else matches the design: the queue, statuses, clocks, ETA cards, deliveries tab,
printouts and the How it works tab.

---

## Phase 0: Setup ✅ done Nov 4, 2026

- [x] Two repos: public `cb156rice/cylinder-tracker` (site), private `cb156rice/cylinder-tracker-data` (data + backend Actions)
- [x] Demo Gmail account `cylindertracker1@gmail.com`. App passwords weren't available on it, so mail access uses the
      **Gmail API with an OAuth refresh token** (Google Cloud project `cylinder-tracker`, Desktop client, scope `gmail.modify`)
- [x] EmailJS account, Gmail service and template; the "To" address is fixed in the template, not in the page
- [x] Gmail secrets in the private repo's Actions secrets: `GMAIL_ADDRESS`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`
- [x] Site deploys to https://cb156rice.github.io/cylinder-tracker/ on every push to `main`
- [ ] Anthropic API key, saved as `ANTHROPIC_API_KEY` in the private repo's Actions secrets (needed in Phase 4)

## Phase 1: Front end with fake data (1–2 weeks part-time)

A working version of every screen, deployed on Pages, with seed data kept in the browser.
This is already a usable demo if the later phases slip.

- [x] Vite + React + TypeScript, with automatic deployment to GitHub Pages
- [x] Port the business rules from the prototype into `src/lib/` with unit tests: business hours
      (`bizMs`, `addBiz`), deadline clocks, routing by building, ETA detection, "to discuss" rules
- [x] Public report form, success state, FAQ and install guide placeholders
- [x] Admin queue: summary cards, filters, table, ticket panel, email thread timeline
- [x] Ticket actions: status, complexity, close-out, Set ETA / Ignore, log call/visit
- [x] Today's deliveries tab, visit agenda and driver stop sheet (printable)
- [x] Keep data behind one interface (`TicketStore`), so Phase 2 swaps the store without touching screens

**Done when:** every button in the design does something believable on the live Pages URL.

## Phase 2: GitHub Issues as the database (about 1 week)

- [x] `GitHubStore`: reads and writes tickets as issues, labels and comments in the private repo
- [x] Admin sign-in screen: paste a fine-grained GitHub token, saved in the browser
- [x] Ticket format: a small JSON block in the issue body for fields (order, building, ETA…),
      comments tagged by kind (email in/out, call, note)
- [x] Polling refresh in the dashboard (every 30–60 s)

**Done when:** two people on different computers see the same tickets and changes.

*Done Nov 13, 2026: tested live against cylinder-tracker-data (sample import, edits, two browsers).*

## Phase 3: Real email, the boss demo (about 1 week)

- [ ] Form sends through EmailJS to the tracker mailbox
- [ ] Mail poller Action: read through the Gmail API, ticket creation, reply matching by `[RG-####]`,
      quoted-text stripping, new participant detection
- [ ] Mailer Action: sends thread messages with `[RG-####]` subjects and threading headers
- [ ] "Check mail now" button (starts the poller through the GitHub API)
- [ ] **Demo mode:** every outgoing email goes to your personal address, with a header line
      "Would go to: Ruben, Gordan · cc Israel, reporter". Real Airgas staff are never emailed.

**Done when (the demo):** your boss submits the form, the "Airgas" email arrives in your inbox,
you reply all, and the reply shows on the ticket with an "ETA found" card.

## Phase 4: Automation and Claude (1–2 weeks)

- [ ] Deadline check (runs inside the mail poller job to save Actions minutes): overdue flag, email to Javier, follow-up on the thread
- [ ] "Draft with Claude" and "Escalate to Chris" as Actions using the prompts in `draftAi()`; drafts are never sent until an admin presses Send
- [ ] Claude reads ETAs out of replies (replaces the regex)
- [ ] Delivery schedule parsing from forwarded emails
- [ ] 4 PM "Did it get fixed? Reply YES or NO" emails and reply handling

## Phase 5: Going live at Rice

Questions for Rice IT and the stockroom:

- [ ] **Mailbox:** can we have `cylinder-issues@rice.edu`? Rice's Microsoft 365 likely needs an app
      registration (Microsoft Graph) instead of IMAP. Otherwise, keep a dedicated Gmail.
- [ ] **Data:** is storing reporter names and emails in a private GitHub repo allowed?
- [ ] **GitHub account:** who owns the repos long term (a Rice GitHub organization, not a student account)?
- [ ] Open questions from `design/README.md`: schedule format, auto-close on YES, Rice holidays,
      other buildings, RUPD/EHS number, FAQ and install guide content from Robert
- [ ] Turn off demo mode, add real addresses, handover notes

## Known limits of the GitHub-only setup

- Replies and new reports show up within minutes, not seconds.
- Admins need GitHub accounts.
- GitHub Actions minutes are limited for private repos (2,000/month free, 3,000 with GitHub Pro
  from the Student Developer Pack), and **each run counts as at least 1 full minute**. Polling every
  5 min around the clock would use about 8,600 min/month. So: run the poller and the deadline
  check as **one job**, every 10 min during business hours (Mon–Fri 8 AM–6 PM, about 1,300 runs a month),
  hourly at night, and use the "Check mail now" button for the demo itself.
  Rice's GitHub plan may raise the limit.
- If Rice ever approves a real server, the front end and business rules carry over;
  only the Actions and the `GitHubStore` get replaced.
