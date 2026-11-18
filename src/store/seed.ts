// Demo data, copied from the prototype. The prototype ran on a frozen clock (Mon Oct 5 2026,
// 2:30 PM). Here every timestamp is moved so it sits the same number of *business* hours before
// the real "now", and every ETA the same number of business days from today. Deadline clocks
// therefore read exactly as in the prototype, whatever day the demo runs.
import { openingEmailText } from '../lib/emails'
import {
  addBizDays, bizDaysBetween, bizMs, dayKey, fromWall, isWeekend, subBiz, type DateKey,
} from '../lib/time'
import type { AirgasContact, PersonId, RiceStaff, ScheduleEntry, ThreadEntry, Ticket } from '../lib/types'

const PROTO_NOW = fromWall(2026, 10, 5, 14, 30)
const PROTO_TODAY: DateKey = '2026-10-05'

/** Seed data plus the simulated Airgas replies the demo's "Simulate reply" button uses. */
export function makeSeed(now: Date): { tickets: Ticket[]; schedule: ScheduleEntry[] } {
  const today = dayKey(now)
  const anchorDay = isWeekend(today) ? addBizDays(today, -1) : today
  /** Prototype wall time (2026) → rebased ISO instant. */
  const at = (m: number, d: number, h = 0, mi = 0) => subBiz(now, bizMs(fromWall(2026, m, d, h, mi), PROTO_NOW)).toISOString()
  /** Prototype calendar day → rebased DateKey. */
  const day = (m: number, d: number) => addBizDays(anchorDay, bizDaysBetween(PROTO_TODAY, `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`))
  const note = (time: string, text: string): ThreadEntry => ({ kind: 'note', at: time, text })
  const email = (from: AirgasContact | RiceStaff, time: string, text: string, added?: PersonId[]): ThreadEntry =>
    ({ kind: 'email', from, at: time, text, ...(added ? { added } : {}) })

  type SeedInput = Partial<Ticket> & Pick<Ticket, 'id' | 'order' | 'building' | 'room' | 'category' | 'description' | 'reporter' | 'createdAt' | 'status' | 'coordinator'>
  const T = (o: SeedInput): Ticket => {
    const t: Ticket = {
      otherBuilding: '', complexity: null, startedAt: null, participants: ['ruben', 'gordan'],
      eta: null, etaSuggestion: null, confirm: null, resolvedBy: null, resolvedAt: null, resolutionNotes: '',
      ...o, thread: [],
    }
    t.thread = [{ kind: 'auto', at: t.createdAt, text: openingEmailText(t) }, ...(o.thread ?? [])]
    return t
  }
  const who = (name: string, email: string, phone = '') => ({ name, email, phone })

  const tickets: Ticket[] = [
    T({ id: 'RG-1048', reporter: who('Hong Zhao', 'hz21@rice.edu'), order: 'AG-58224410', building: 'sst', room: '312', category: 'leak',
      description: 'Cylinder was venting and the dewar is dented.', createdAt: at(10, 5, 9, 12), status: 'progress', startedAt: at(10, 5, 9, 40),
      complexity: 'medium', coordinator: 'israel', participants: ['ruben', 'gordan', 'javier', 'chris'],
      etaSuggestion: { from: 'gordan', quote: "I'll send a replacement on tomorrow's truck.", date: day(10, 6) },
      thread: [
        note(at(10, 5, 9, 40), 'Israel moved to In progress · Medium'),
        email('ruben', at(10, 5, 10, 30), 'Thanks Israel. Can you send a photo of the dent? Adding Javier.', ['javier']),
        email('israel', at(10, 5, 10, 52), 'Photo attached. The lab moved the dewar to the vented hallway area.'),
        email('ruben', at(10, 5, 11, 50), 'Looping in Chris to approve a replacement.', ['chris']),
        email('gordan', at(10, 5, 13, 5), "I'll send a replacement on tomorrow's truck."),
      ] }),
    T({ id: 'RG-1047', reporter: who('Priya Raman', 'pr42@rice.edu', '713-348-2211'), order: 'AG-58213947', building: 'sst', room: '214', category: 'leak',
      description: 'Faint hissing at the regulator connection on the nitrogen cylinder in the fume hood bay. Closed the main valve for now.',
      createdAt: at(10, 5, 10, 5), status: 'open', coordinator: 'israel' }),
    T({ id: 'RG-1046', reporter: who('Aisha Bello', 'ab118@rice.edu'), order: 'AG-58211502', building: 'sst', room: '240', category: 'empty',
      description: 'Oxygen cylinder from the last delivery is already reading empty.', createdAt: at(10, 2, 16, 20), status: 'progress',
      startedAt: at(10, 5, 9, 15), complexity: 'medium', coordinator: 'israel', eta: day(10, 5),
      thread: [
        email('ruben', at(10, 5, 9, 10), "Plant confirmed a bad fill. The replacement goes out on today's truck."),
        note(at(10, 5, 9, 15), "ETA set from Ruben's reply"),
      ] }),
    T({ id: 'RG-1045', reporter: who('Elena Duarte', 'ed31@rice.edu', '713-348-5520'), order: 'AG-58209811', building: 'sst', room: '118', category: 'empty',
      description: 'New CO2 cylinder reads about half on the gauge right after delivery.', createdAt: at(10, 2, 9, 30), status: 'progress',
      startedAt: at(10, 2, 13, 0), complexity: 'low', coordinator: 'israel', eta: day(10, 5),
      thread: [
        email('gordan', at(10, 2, 13, 10), "We'll swap it on the next delivery day."),
        note(at(10, 2, 13, 15), "ETA set from Gordan's reply"),
      ] }),
    T({ id: 'RG-1044', reporter: who('Marcus Lee', 'ml77@rice.edu'), order: 'AG-58207730', building: 'oconnor', room: '310', category: 'notdelivered',
      description: 'Argon order confirmation gave a delivery date that has passed. Nothing at the dock or the lab.', createdAt: at(9, 30, 11, 0),
      status: 'open', coordinator: 'robert',
      thread: [
        { kind: 'auto', at: at(10, 1, 15, 0), followUp: true, text: 'Following up on RG-1044. We are still waiting on an ETA for this order.' },
      ] }),
    T({ id: 'RG-1043', reporter: who('Tom Nguyen', 'tn12@rice.edu', '713-348-9034'), order: 'AG-58201418', building: 'oconnor', room: '205', category: 'other',
      description: "Regulator fitting doesn't match the new helium cylinder. Can't connect it.", createdAt: at(9, 30, 9, 15), status: 'progress',
      startedAt: at(9, 30, 10, 0), complexity: 'high', coordinator: 'robert',
      thread: [
        note(at(9, 30, 10, 0), 'Robert moved to In progress · High'),
        email('ruben', at(9, 30, 14, 20), 'Which regulator is the lab using? Need the CGA number.'),
        email('robert', at(9, 30, 15, 2), 'It is a CGA 580 regulator.'),
        { kind: 'visit', at: at(10, 1, 10, 30), from: 'robert', with: 'ruben', text: "Ruben stopped by O'Connor and looked at the fitting. He'll order an adapter." },
      ] }),
    T({ id: 'RG-1042', reporter: who('Daniel Ortiz', 'do9@rice.edu'), order: 'AG-58198004', building: 'oconnor', room: '122', category: 'leak',
      description: 'Leak detector solution bubbling at the valve stem.', createdAt: at(9, 29, 9, 40), status: 'done', startedAt: at(9, 29, 10, 30),
      complexity: 'low', coordinator: 'robert', resolvedBy: 'robert', resolvedAt: at(9, 29, 15, 40), resolutionNotes: 'Valve packing nut tightened; leak test passed.',
      thread: [
        { kind: 'call', at: at(9, 29, 11, 0), from: 'robert', with: 'gordan', text: 'Gordan said tightening the packing nut is fine; they will check the cap on the next delivery.' },
        note(at(9, 29, 15, 40), 'Completed by Robert'),
      ] }),
    T({ id: 'RG-1041', reporter: who('Sofia Kim', 'sk64@rice.edu'), order: 'AG-58190277', building: 'sst', room: '330', category: 'notdelivered',
      description: 'Nitrogen delivery missed.', createdAt: at(9, 25, 14, 0), status: 'done', startedAt: at(9, 25, 15, 0), complexity: 'low',
      coordinator: 'israel', resolvedBy: 'airgas', resolvedAt: at(9, 28, 16, 5), resolutionNotes: 'Lab confirmed fixed after delivery.', confirm: 'yes', eta: day(9, 28),
      thread: [
        email('gordan', at(9, 25, 16, 0), 'Missed due to dock access. Rescheduled for the next delivery day.'),
        { kind: 'confirm', at: at(9, 28, 16, 5), text: "Yes, it's fixed.", fixed: true },
        note(at(9, 28, 16, 5), 'Closed after lab confirmation'),
      ] }),
  ]

  const schedule: ScheduleEntry[] = [
    { date: anchorDay, order: 'AG-58211502', site: 'Rice · SST dock', item: 'Oxygen, 1 cylinder · replacement' },
    { date: anchorDay, order: 'AG-58207730', site: "Rice · O'Connor dock", item: 'Argon, 2 cylinders' },
    { date: anchorDay, order: 'AG-58230115', site: 'Rice · BRC dock', item: 'Nitrogen dewar, 1' },
    { date: anchorDay, order: 'AG-58231890', site: 'Rice · SST dock', item: 'Helium, 1 cylinder' },
  ]
  return { tickets, schedule }
}

/** Canned Airgas replies for the demo's "Simulate Airgas reply" button, cycled per ticket. */
const SIM: Record<string, [AirgasContact, string][]> = {
  'RG-1047': [['gordan', "We'll swap the nitrogen cylinder on tomorrow's truck. Please keep the valve closed until then."]],
  'RG-1044': [['ruben', "Sorry for the delay. The argon order missed last week's route. It's on today's truck."]],
  'RG-1043': [['ruben', 'The CGA 580 adapter is in. It will go out Thursday.']],
}
const SIM_DEFAULT: [AirgasContact, string][] = [
  ['ruben', 'Thanks, checking with the plant and will get back to you.'],
  ['gordan', "This will be on Wednesday's truck."],
]
export function simulatedReply(ticketId: string, n: number): { from: AirgasContact; text: string } {
  const list = SIM[ticketId] ?? SIM_DEFAULT
  const [from, text] = list[n % list.length]
  return { from, text }
}
