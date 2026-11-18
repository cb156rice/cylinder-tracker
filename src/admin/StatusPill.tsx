import { STATUS_LABEL } from '../lib/rules'
import type { Status } from '../lib/types'

/** Status as plain text. Color is saved for the one thing that needs attention: late tickets. */
export function StatusPill({ status }: { status: Status }) {
  return <span className={'status status--' + status}>{STATUS_LABEL[status]}</span>
}
