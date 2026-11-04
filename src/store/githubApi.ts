// The handful of GitHub REST calls the dashboard needs. Runs in the browser with the admin's
// fine-grained token (Issues: read/write on the private data repo).

export interface Issue {
  number: number
  title: string
  body: string | null
  updated_at: string
  pull_request?: unknown
}
export interface Comment {
  id: number
  body: string
  created_at: string
  issue_url: string
}

export class GitHubError extends Error {
  readonly status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export class GitHubApi {
  private readonly token: string
  readonly owner: string
  readonly repo: string
  private readonly fetchFn: typeof fetch

  constructor(token: string, owner: string, repo: string, fetchFn: typeof fetch = (...a) => fetch(...a)) {
    this.token = token
    this.owner = owner
    this.repo = repo
    this.fetchFn = fetchFn
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchFn(`https://api.github.com${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
    if (!res.ok) {
      let msg = res.statusText
      try { msg = ((await res.json()) as { message?: string }).message ?? msg } catch { /* not JSON */ }
      throw new GitHubError(res.status, explain(res.status, msg))
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
  }

  private get base() { return `/repos/${this.owner}/${this.repo}` }

  /** All pages of a list endpoint (100 per page). */
  private async all<T>(path: string): Promise<T[]> {
    const out: T[] = []
    for (let page = 1; page < 50; page++) {
      const batch = await this.call<T[]>('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
      out.push(...batch)
      if (batch.length < 100) break
    }
    return out
  }

  /** Checks the token can see the repo. Returns whether it's private. */
  async checkRepo(): Promise<{ private: boolean }> {
    return this.call('GET', this.base)
  }

  async listIssues(): Promise<Issue[]> {
    return (await this.all<Issue>(`${this.base}/issues?state=all&sort=created&direction=desc`)).filter(i => !i.pull_request)
  }
  getIssue(n: number) { return this.call<Issue>('GET', `${this.base}/issues/${n}`) }
  createIssue(title: string, body: string) { return this.call<Issue>('POST', `${this.base}/issues`, { title, body }) }
  updateIssue(n: number, fields: { title?: string; body?: string; state?: 'open' | 'closed' }) {
    return this.call<Issue>('PATCH', `${this.base}/issues/${n}`, fields)
  }
  setLabels(n: number, labels: string[]) { return this.call<unknown>('PUT', `${this.base}/issues/${n}/labels`, { labels }) }

  /** Comments across the whole repo, oldest first, optionally only those updated since an instant. */
  listComments(since?: string) {
    return this.all<Comment>(`${this.base}/issues/comments?sort=created&direction=asc${since ? `&since=${encodeURIComponent(since)}` : ''}`)
  }
  listIssueComments(n: number) { return this.all<Comment>(`${this.base}/issues/${n}/comments`) }
  createComment(n: number, body: string) { return this.call<Comment>('POST', `${this.base}/issues/${n}/comments`, { body }) }
}

export const issueOfComment = (c: Comment) => Number(c.issue_url.split('/').pop())

function explain(status: number, msg: string): string {
  if (status === 401) return 'GitHub rejected the token (expired or mistyped). Connect again with a new token.'
  if (status === 403 && /rate limit/i.test(msg)) return 'GitHub rate limit reached. Wait a few minutes and try again.'
  if (status === 403) return `The token doesn't have permission for this (${msg}). It needs Issues: Read and write on the data repo.`
  if (status === 404) return "GitHub can't find the data repo with this token. Check the token has access to it."
  return `GitHub error ${status}: ${msg}`
}
