// Timed steps the tracker takes on its own, before the mailer sends what they queue:
//  - Airgas hasn't replied 12 business hours after the report → follow up on the thread.
//  - The fix due date has passed → ask the reporter "Is it fixed?".
// Only tickets from the real form; sample tickets loaded for a demo never email anyone.
import { checkInDue, followUpDue } from '../src/lib/rules'
import { askFixed, followUp } from '../src/lib/transitions'
import type { Ticket } from '../src/lib/types'
import type { GitHubStore } from '../src/store/githubStore'

export interface StepsResult { followedUp: string[]; asked: string[] }

const fromForm = (t: Ticket) => !!t.thread[0]?.ref?.startsWith('report:')

export async function timedSteps(store: GitHubStore, now: Date, log: (s: string) => void = console.log): Promise<StepsResult> {
  const result: StepsResult = { followedUp: [], asked: [] }
  for (const t of await store.list()) {
    if (!fromForm(t)) continue
    try {
      // Each check runs again on the fresh copy inside update, so two runs can't both act.
      if (followUpDue(t, now)) {
        await store.update(t.id, (x, n) => (followUpDue(x, n) ? followUp(x, n) : x))
        result.followedUp.push(t.id)
        log(`  ↻ ${t.id}: no reply from Airgas in 12 business hours, following up`)
      }
      if (checkInDue(t, now)) {
        await store.update(t.id, (x, n) => (checkInDue(x, n) ? askFixed(x, n) : x))
        result.asked.push(t.id)
        log(`  ? ${t.id}: asking ${t.reporter.name} if it's fixed`)
      }
    } catch (e) {
      log(`  ! ${t.id}: ${(e as Error).message}`)
    }
  }
  return result
}
