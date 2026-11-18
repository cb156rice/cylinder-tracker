// Asks reporters "Is it fixed? Reply YES or NO" once a ticket's fix due date has passed
// (Airgas's date, or 2 business days after the report). The mailer sends it in the same run.
import { checkInDue } from '../src/lib/rules'
import { askFixed } from '../src/lib/transitions'
import type { GitHubStore } from '../src/store/githubStore'

export async function askReporters(store: GitHubStore, now: Date, log: (s: string) => void = console.log): Promise<string[]> {
  const asked: string[] = []
  for (const t of await store.list()) {
    // Only tickets from the real form (their opening email carries the submission id). Sample tickets loaded
    // into the repo for a demo never email anyone.
    const fromForm = t.thread[0]?.ref?.startsWith('report:')
    if (!fromForm || !checkInDue(t, now)) continue
    try {
      // Check again on the fresh copy inside update, so two runs can't both ask.
      await store.update(t.id, (x, n) => (checkInDue(x, n) ? askFixed(x, n) : x))
      asked.push(t.id)
      log(`  ? ${t.id}: asking ${t.reporter.name} if it's fixed`)
    } catch (e) {
      log(`  ! ${t.id}: could not queue the check-in: ${(e as Error).message}`)
    }
  }
  return asked
}
