// Live store: tickets are issues in the private data repo (format in githubFormat.ts).
// Everyone with a token sees the same data; the dashboard refreshes every 45 s.
import { createTicket, validateReport } from '../lib/rules'
import type { ReportInput, ScheduleEntry, ThreadEntry, Ticket } from '../lib/types'
import { GitHubApi, GitHubError, issueOfComment, type Comment, type Issue } from './githubApi'

/** The mail job's workflow file in the data repo (.github/workflows/mail.yml). */
export const MAIL_WORKFLOW = 'mail.yml'
import {
  issueLabels, issueNumber, issueTitle, parseBody, parseComment, renderBody, renderComment, ticketId, type TicketFields,
} from './githubFormat'
import type { Change, StoreStatus, TicketStore } from './store'

interface Cached {
  fields: TicketFields
  /** Thread entries keyed by comment id (so re-fetching never duplicates). */
  entries: Map<number, ThreadEntry>
}

export class GitHubStore implements TicketStore {
  readonly mode = 'github' as const
  readonly refreshMs = 45_000
  private cache = new Map<number, Cached>()
  private commentsSince: string | undefined
  private listeners = new Set<() => void>()
  private state: StoreStatus = { syncing: false, error: null, lastSync: null }
  private loaded: Promise<void> | null = null

  readonly api: GitHubApi
  private readonly clock: () => Date

  constructor(api: GitHubApi, clock: () => Date = () => new Date()) {
    this.api = api
    this.clock = clock
  }

  now() { return this.clock() }
  status() { return this.state }

  async list() {
    // First load only; failures show in status() and the 45 s refresh retries.
    await (this.loaded ??= this.refresh().catch(() => {}))
    return [...this.cache.entries()].map(([n, c]) => toTicket(n, c)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  /** The schedule arrives by email in Phase 3; until then there is none in live mode. */
  async schedule(): Promise<ScheduleEntry[]> { return [] }

  /** Pulls issues and any comments added since the last refresh. */
  async refresh(): Promise<void> {
    this.setState({ syncing: true })
    try {
      const startedAt = new Date().toISOString()
      const issues = await this.api.listIssues()
      for (const issue of issues) {
        const fields = parseBody(issue.body ?? '')
        if (!fields) continue
        const c = this.cache.get(issue.number)
        if (c) c.fields = fields
        else this.cache.set(issue.number, { fields, entries: new Map() })
      }
      this.addComments(await this.api.listComments(this.commentsSince))
      // Overlap a little so a comment created during this refresh isn't missed next time.
      this.commentsSince = new Date(Date.parse(startedAt) - 60_000).toISOString()
      this.setState({ syncing: false, error: null, lastSync: new Date() })
    } catch (e) {
      this.setState({ syncing: false, error: (e as Error).message })
      throw e
    }
  }

  /** `at` and `ref` are for the mail poller: the form's submit time, and the submission id on the opening entry. */
  async create(input: ReportInput, opts: { at?: Date; ref?: string } = {}) {
    const errors = validateReport(input)
    if (Object.keys(errors).length) throw new Error('Report is not valid: ' + Object.keys(errors).join(', '))
    const draft = createTicket(input, 'RG-new', opts.at ?? this.now())
    if (opts.ref) draft.thread[0] = { ...draft.thread[0], ref: opts.ref }
    return this.guard(async () => {
      const issue = await this.api.createIssue(issueTitle(draft), renderBody(draft))
      const t: Ticket = { ...draft, id: ticketId(issue.number) }
      await this.api.updateIssue(issue.number, { title: issueTitle(t) })
      await this.labels(issue.number, t)
      const c: Cached = { fields: parseBody(renderBody(t))!, entries: new Map() }
      this.cache.set(issue.number, c)
      for (const e of t.thread) c.entries.set((await this.api.createComment(issue.number, renderComment(e, t))).id, e)
      this.emit()
      return toTicket(issue.number, c)
    })
  }

  async update(id: string, change: Change) {
    const n = issueNumber(id)
    return this.guard(async () => {
      // Re-read just this ticket so the change applies to the latest version.
      const [issue, comments] = await Promise.all([this.api.getIssue(n), this.api.listIssueComments(n)])
      const c = this.fromIssue(issue, comments)
      const before = toTicket(n, c)
      const after = change(before, this.now())

      // Transitions only append to the thread; post the new entries as comments.
      for (const e of after.thread.slice(before.thread.length)) {
        c.entries.set((await this.api.createComment(n, renderComment(e, after))).id, e)
      }
      const { id: _a, thread: _b, ...fields } = after
      if (JSON.stringify(fields) !== JSON.stringify(c.fields)) {
        await this.api.updateIssue(n, {
          title: issueTitle(after),
          body: renderBody(after),
          state: after.status === 'done' ? 'closed' : 'open',
        })
        c.fields = fields
        if (before.status !== after.status || before.coordinator !== after.coordinator) await this.labels(n, after)
      }
      this.emit()
      return toTicket(n, c)
    })
  }

  /** Copies tickets (e.g. the demo sample) into the repo. Used to fill an empty repo for a demo. */
  async importTickets(tickets: Ticket[], onProgress?: (done: number) => void) {
    let done = 0
    for (const src of [...tickets].reverse()) { // oldest first, so issue numbers follow creation order
      await this.guard(async () => {
        const issue = await this.api.createIssue(issueTitle(src), renderBody(src))
        const t = { ...src, id: ticketId(issue.number) }
        await this.api.updateIssue(issue.number, { title: issueTitle(t), ...(t.status === 'done' ? { state: 'closed' as const } : {}) })
        await this.labels(issue.number, t)
        const c: Cached = { fields: parseBody(renderBody(t))!, entries: new Map() }
        this.cache.set(issue.number, c)
        for (const e of t.thread) c.entries.set((await this.api.createComment(issue.number, renderComment(e, t))).id, e)
      })
      onProgress?.(++done)
      this.emit()
    }
  }

  /**
   * "Check mail now": starts the mail job in the data repo (read inbox, follow-ups, send queued emails),
   * waits for it to finish (usually about a minute) and refreshes. Resolves with the run's conclusion.
   */
  async checkMail(onRunning?: () => void, pollMs = 5000): Promise<string> {
    const started = Date.now()
    try {
      await this.api.runWorkflow(MAIL_WORKFLOW)
    } catch (e) {
      if (e instanceof GitHubError && (e.status === 403 || e.status === 404)) {
        throw new Error('"Check mail now" needs one more permission on your GitHub token: Actions → Read and write. Edit the token on github.com, then try again.')
      }
      throw e
    }
    onRunning?.()
    const deadline = started + 5 * 60_000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, pollMs))
      // GitHub doesn't return the new run's id, so take the newest run started after the click.
      const run = (await this.api.workflowRuns(MAIL_WORKFLOW)).find(r => Date.parse(r.created_at) >= started - 10_000)
      if (run?.status === 'completed') {
        await this.refresh().catch(() => {})
        return run.conclusion ?? 'unknown'
      }
    }
    await this.refresh().catch(() => {})
    return 'timed out'
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  // ---- internals ----

  private fromIssue(issue: Issue, comments: Comment[]): Cached {
    const fields = parseBody(issue.body ?? '')
    if (!fields) throw new Error(`Issue #${issue.number} isn't a tracker ticket.`)
    const c: Cached = { fields, entries: new Map() }
    for (const cm of comments) {
      const e = parseComment(cm.body)
      if (e) c.entries.set(cm.id, e)
    }
    this.cache.set(issue.number, c)
    return c
  }

  private addComments(comments: Comment[]) {
    for (const cm of comments) {
      const c = this.cache.get(issueOfComment(cm))
      const e = c && parseComment(cm.body)
      if (c && e) c.entries.set(cm.id, e)
    }
  }

  /** Labels are for browsing on github.com only; a failure here shouldn't block the change. */
  private async labels(n: number, t: Ticket) {
    try { await this.api.setLabels(n, issueLabels(t)) } catch { /* ignore */ }
  }

  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const r = await fn()
      if (this.state.error) this.setState({ error: null })
      return r
    } catch (e) {
      this.setState({ error: `Couldn't save: ${(e as Error).message}` })
      throw e
    }
  }

  private setState(p: Partial<StoreStatus>) {
    this.state = { ...this.state, ...p }
    this.emit()
  }

  private emit() { this.listeners.forEach(l => l()) }
}

function toTicket(n: number, c: Cached): Ticket {
  // Sort by time; comment ids break ties (they increase in creation order).
  const thread = [...c.entries.entries()].sort(([ia, a], [ib, b]) => a.at.localeCompare(b.at) || ia - ib).map(([, e]) => e)
  return { id: ticketId(n), ...c.fields, thread }
}
