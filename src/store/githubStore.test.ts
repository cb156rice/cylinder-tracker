import { describe, expect, it } from 'vitest'
import { fromWall } from '../lib/time'
import { receiveEmail, startProgress } from '../lib/transitions'
import { GitHubApi, GitHubError } from './githubApi'
import { fakeGitHub } from './fakeGitHub'
import { GitHubStore } from './githubStore'
import { makeSeed } from './seed'

const NOW = fromWall(2026, 11, 4, 10, 12)
const REPORT = { name: 'A B', email: 'ab@rice.edu', phone: '', order: 'AG-1', building: 'sst' as const, otherBuilding: '', room: '101', category: 'leak' as const, description: '' }

describe('GitHubStore', () => {
  it('creates a ticket as an issue whose number gives the ID, with the opening email as a comment', async () => {
    const gh = fakeGitHub()
    const store = new GitHubStore(gh.api(), () => NOW)
    const t = await store.create(REPORT)
    expect(t.id).toBe('RG-1001')
    expect(gh.issues[0]).toMatchObject({ title: '[RG-1001] Leak · SST 101', labels: ['status:open', 'building:sst', 'coordinator:israel'] })
    expect(gh.comments).toHaveLength(1)
    expect(t.thread[0].kind).toBe('auto')
  })

  it('shows the same data to a second browser, including later changes', async () => {
    const gh = fakeGitHub()
    const a = new GitHubStore(gh.api(), () => NOW)
    const b = new GitHubStore(gh.api(), () => NOW)
    const t = await a.create(REPORT)
    expect((await b.list()).map(x => x.id)).toEqual([t.id])

    await a.update(t.id, (x, n) => startProgress(x, 'israel', n))
    await a.update(t.id, (x, n) => receiveEmail(x, 'ruben', "It's on today's truck.", n))
    await b.refresh()
    const seen = (await b.list())[0]
    expect(seen.status).toBe('progress')
    expect(seen.etaSuggestion?.date).toBe('2026-11-04')
    expect(seen.thread.map(e => e.kind)).toEqual(['auto', 'note', 'email'])
    expect(gh.issues[0].labels).toContain('status:progress')
  })

  it("doesn't lose a message another browser added in the meantime", async () => {
    const gh = fakeGitHub()
    const a = new GitHubStore(gh.api(), () => NOW)
    const b = new GitHubStore(gh.api(), () => NOW)
    const t = await a.create(REPORT)
    await b.list()
    await a.update(t.id, (x, n) => receiveEmail(x, 'gordan', 'Checking.', n))
    await b.update(t.id, (x, n) => startProgress(x, 'israel', n)) // b hasn't refreshed, but update re-reads
    const final = (await new GitHubStore(gh.api(), () => NOW).list())[0]
    expect(final.thread.map(e => e.kind)).toEqual(['auto', 'email', 'note'])
    expect(final.status).toBe('progress')
  })

  it('imports the demo sample and closes completed tickets', async () => {
    const gh = fakeGitHub()
    const store = new GitHubStore(gh.api(), () => NOW)
    await store.importTickets(makeSeed(NOW).tickets)
    const list = await store.list()
    expect(list).toHaveLength(8)
    expect(list.map(t => t.id)).toContain('RG-1008')
    expect(gh.issues.filter(i => i.state === 'closed')).toHaveLength(2)
    const fresh = await new GitHubStore(gh.api(), () => NOW).list()
    expect(fresh.find(t => t.reporter.name === 'Hong Zhao')?.thread).toHaveLength(6)
  })

  it('reports errors in status without throwing from list()', async () => {
    const api = new GitHubApi('bad', 'o', 'r', (async () => new Response('{"message":"Bad credentials"}', { status: 401 })) as typeof fetch)
    const store = new GitHubStore(api, () => NOW)
    expect(await store.list()).toEqual([])
    expect(store.status().error).toContain('rejected the token')
  })

  it('"Check mail now" starts the mail job, waits for it, and explains a missing permission', async () => {
    const api = fakeGitHub().api()
    const runs: { id: number; status: string; conclusion: string | null; created_at: string; html_url: string }[] = []
    let polls = 0
    api.runWorkflow = async () => { runs.unshift({ id: 1, status: 'queued', conclusion: null, created_at: new Date().toISOString(), html_url: '' }) }
    api.workflowRuns = async () => { if (++polls === 2) Object.assign(runs[0], { status: 'completed', conclusion: 'success' }); return runs }
    const store = new GitHubStore(api)
    let running = false
    expect(await store.checkMail(() => { running = true }, 1)).toBe('success')
    expect(running).toBe(true)

    api.runWorkflow = async () => { throw new GitHubError(403, 'Resource not accessible by personal access token') }
    await expect(store.checkMail(undefined, 1)).rejects.toThrow('Actions → Read and write')
  })
})
