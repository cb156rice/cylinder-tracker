// Test helper: an in-memory stand-in for the GitHub REST endpoints GitHubStore uses.
import { GitHubApi, type Comment, type Issue } from './githubApi'

/** A tiny in-memory stand-in for the GitHub REST endpoints the store uses. */
export function fakeGitHub() {
  const issues: (Issue & { state: string; labels: string[] })[] = []
  const comments: Comment[] = []
  let nextComment = 1
  const calls: string[] = []
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  const fetchFn = (async (url: string, init?: RequestInit) => {
    const u = new URL(url)
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(init.body as string) : null
    const path = u.pathname.replace('/repos/o/r', '')
    const page = Number(u.searchParams.get('page') ?? 1)
    const pageOf = <T,>(xs: T[]) => xs.slice((page - 1) * 100, page * 100)
    calls.push(`${method} ${path}`)
    let m: RegExpMatchArray | null
    if (method === 'GET' && path === '') return json({ private: true })
    if (method === 'GET' && path === '/issues') return json(pageOf([...issues].reverse()))
    if (method === 'POST' && path === '/issues') {
      const i = { number: issues.length + 1, title: body.title, body: body.body, updated_at: '', state: 'open', labels: [] }
      issues.push(i); return json(i, 201)
    }
    if ((m = path.match(/^\/issues\/(\d+)$/))) {
      const i = issues[Number(m[1]) - 1]
      if (method === 'PATCH') Object.assign(i, body)
      return json(i)
    }
    if ((m = path.match(/^\/issues\/(\d+)\/labels$/))) { issues[Number(m[1]) - 1].labels = body.labels; return json([]) }
    if ((m = path.match(/^\/issues\/(\d+)\/comments$/))) {
      const n = Number(m[1])
      if (method === 'POST') {
        const c = { id: nextComment++, body: body.body, created_at: '', issue_url: `https://api.github.com/repos/o/r/issues/${n}` }
        comments.push(c); return json(c, 201)
      }
      return json(pageOf(comments.filter(c => c.issue_url.endsWith(`/${n}`))))
    }
    if (method === 'GET' && path === '/issues/comments') return json(pageOf(comments))
    return json({ message: 'Not Found' }, 404)
  }) as typeof fetch
  return { issues, comments, calls, api: () => new GitHubApi('tok', 'o', 'r', fetchFn) }
}
