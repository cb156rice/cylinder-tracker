// Entry point for the "mail" job, run by GitHub Actions in the private data repo.
// Env (from that repo's secrets/variables):
//   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN   tracker mailbox
//   GITHUB_TOKEN, GITHUB_REPOSITORY                               the data repo (set by Actions)
//   AIRGAS_ADDRESSES, STAFF_ADDRESSES                             comma lists: who counts as Airgas / Rice staff
import { appendFileSync } from 'node:fs'
import { GitHubApi } from '../src/store/githubApi'
import { GitHubStore } from '../src/store/githubStore'
import { Gmail } from './gmail'
import { parseDirectory } from './parse'
import { askReporters } from './checkins'
import { sendOutbox } from './mailer'
import { pollInbox } from './poller'

function need(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name}. Add it under the data repo's Settings → Secrets and variables → Actions.`)
  return v
}

async function main() {
  const [owner, repo] = need('GITHUB_REPOSITORY').split('/')
  const store = new GitHubStore(new GitHubApi(need('GITHUB_TOKEN'), owner, repo))
  const gmail = new Gmail({ clientId: need('GMAIL_CLIENT_ID'), clientSecret: need('GMAIL_CLIENT_SECRET'), refreshToken: need('GMAIL_REFRESH_TOKEN') })
  const dir = parseDirectory(process.env)
  if (!dir.airgas.length || !dir.staff.length) console.warn('Warning: AIRGAS_ADDRESSES or STAFF_ADDRESSES is empty; replies from them will be treated as unknown senders.')

  const r = await pollInbox(gmail, store, dir)
  console.log('Checking which reporters to ask "Is it fixed?"')
  const asked = await askReporters(store, new Date())
  console.log('Sending queued emails')
  const m = await sendOutbox(gmail, store, dir, new Date())
  const summary = [
    '### Mail poller',
    `- New tickets: ${r.created.join(', ') || 'none'}`,
    `- Replies added: ${r.replies.join(', ') || 'none'}`,
    `- Fix check-ins: asked ${asked.join(', ') || 'none'}; answers ${r.answers.join(', ') || 'none'}`,
    `- Skipped (not tracker mail): ${r.skipped.length}`,
    `- Already processed: ${r.duplicates}`,
    `- Emails sent: ${m.sent.join(', ') || 'none'}`,
    ...(m.failed.length ? [`- **Could not send:** ${m.failed.join(', ')} (will retry next run)`] : []),
  ].join('\n')
  console.log(summary)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n')
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
