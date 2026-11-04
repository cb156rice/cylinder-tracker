import { STATUS_LABEL } from '../lib/rules'
import type { Status } from '../lib/types'
import { STATUS_COLORS } from './display'

export function StatusPill({ status }: { status: Status }) {
  const c = STATUS_COLORS[status]
  return (
    <span className="pill" style={{ background: c.bg, color: c.fg }}>
      <span className="dot" style={{ background: c.dot }} />{STATUS_LABEL[status]}
    </span>
  )
}
