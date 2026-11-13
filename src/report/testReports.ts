import type { ReportInput } from '../lib/types'

// Local-only helper: random but realistic reports so testing the email flow doesn't mean retyping the form.
// The reporter email comes from VITE_TEST_EMAIL in .env.local (git-ignored), so no real address ships in the public site.

type Scenario = Omit<ReportInput, 'name' | 'email' | 'phone' | 'room'>

const SCENARIOS: Scenario[] = [
  { building: 'sst', otherBuilding: '', category: 'leak', order: '', description: 'Hissing at the regulator connection on the nitrogen cylinder. Snoop test bubbles at the CGA fitting after re-tightening.' },
  { building: 'sst', otherBuilding: '', category: 'leak', order: '', description: 'Argon cylinder loses about 200 psi overnight with the valve closed. Suspect the valve stem packing.' },
  { building: 'oconnor', otherBuilding: '', category: 'leak', order: '', description: 'Faint odor near the CO2 cylinder in the fume hood; leak test shows slow bubbles at the valve outlet.' },
  { building: 'sst', otherBuilding: '', category: 'notdelivered', order: '', description: 'Helium cylinder ordered last week was supposed to arrive on the last delivery day. Nothing at the dock or the lab.' },
  { building: 'oconnor', otherBuilding: '', category: 'notdelivered', order: '', description: 'Two size-300 nitrogen cylinders on order; only one was delivered and the packing slip lists both.' },
  { building: 'oconnor', otherBuilding: '', category: 'empty', order: '', description: 'New oxygen cylinder delivered yesterday reads 900 psi on the gauge. Full should be about 2,200.' },
  { building: 'sst', otherBuilding: '', category: 'empty', order: '', description: 'Hydrogen cylinder arrived half full (gauge around 1,000 psi). Tag says full.' },
  { building: 'other', otherBuilding: 'BioScience Research Collaborative', category: 'other', order: '', description: 'Cylinder delivered without a valve cap and the label is torn; not sure which gas it is. It is chained in the hallway.' },
  { building: 'other', otherBuilding: 'Brockman Hall', category: 'notdelivered', order: '', description: 'Liquid nitrogen dewar refill was scheduled for this week and has not shown up yet.' },
  { building: 'sst', otherBuilding: '', category: 'other', order: '', description: 'Need the empty cylinders in room hallway picked up; there are four and they are blocking the eyewash.' },
]

const FIRST = ['Maria', 'Wei', 'Daniel', 'Priya', 'Lucas', 'Aisha', 'Tom', 'Sofia', 'Kenji', 'Grace']
const LAST = ['Garcia', 'Chen', 'Okafor', 'Patel', 'Silva', 'Nguyen', 'Brown', 'Rossi', 'Tanaka', 'Kim']

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')

export const testEmail: string | undefined = import.meta.env.DEV ? import.meta.env.VITE_TEST_EMAIL : undefined

export function randomTestReport(): ReportInput {
  const s = pick(SCENARIOS)
  return {
    ...s,
    name: `${pick(FIRST)} ${pick(LAST)} (TEST)`,
    email: testEmail ?? '',
    phone: Math.random() < 0.6 ? `713-348-${digits(4)}` : '',
    room: `${1 + Math.floor(Math.random() * 4)}${digits(2)}`,
    order: s.category === 'notdelivered' || Math.random() < 0.4 ? `SO-${digits(7)}` : '',
    description: `TEST · ${s.description}`,
  }
}
