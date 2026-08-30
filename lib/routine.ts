/**
 * The daily routine from the campaign plan (section 04 — "The day, rebuilt
 * around a morning brain"). Three day shapes; the guide picks today's by IST
 * weekday and highlights the row the clock is currently inside.
 */

export type RoutineRow = {
  start: string // "05:15"
  end: string | null
  title: string
  detail?: string
  kind: 'study' | 'life' | 'work' | 'sleep'
}

export type DayRoutine = {
  key: 'weekday' | 'saturday' | 'sunday'
  label: string
  studyLoad: string
  rows: RoutineRow[]
}

export const WEEKDAY: DayRoutine = {
  key: 'weekday',
  label: 'Weekday · Mon–Fri',
  studyLoad: '4h 40m study',
  rows: [
    { start: '05:15', end: '05:30', title: 'Wake, water, out of bed', kind: 'life' },
    { start: '05:30', end: '07:00', title: 'Block A — 90 min', detail: 'Newest, hardest subject. Nothing else touches this slot.', kind: 'study' },
    { start: '07:00', end: '08:00', title: 'Gym', kind: 'life' },
    { start: '08:00', end: '08:50', title: 'Shower, breakfast, walk to office', kind: 'life' },
    { start: '09:00', end: '18:00', title: 'Noboru World', kind: 'work' },
    { start: '18:10', end: '19:00', title: 'Decompress', detail: 'Protected, not negotiable.', kind: 'life' },
    { start: '19:00', end: '21:00', title: 'Block B — 120 min', detail: 'Second subject, first reading + notes into the app.', kind: 'study' },
    { start: '21:00', end: '21:40', title: 'Dinner', kind: 'life' },
    { start: '21:40', end: '22:50', title: 'Block C — 70 min', detail: 'Revision queue + MCQs only. No new material after 21:40.', kind: 'study' },
    { start: '22:50', end: '23:00', title: 'Log the day, load tomorrow', kind: 'life' },
    { start: '23:00', end: null, title: 'Sleep — 6h 15m', kind: 'sleep' },
  ],
}

export const SATURDAY: DayRoutine = {
  key: 'saturday',
  label: 'Saturday · Build day',
  studyLoad: '10h 30m study',
  rows: [
    { start: '05:30', end: '07:00', title: 'Block A — 90 min', kind: 'study' },
    { start: '07:00', end: '08:45', title: 'Gym, breakfast', kind: 'life' },
    { start: '09:00', end: '12:00', title: 'Block B — 180 min', detail: "Deep first-reading of the week's heaviest subject.", kind: 'study' },
    { start: '12:00', end: '14:00', title: 'Lunch, nap', detail: 'Take the nap.', kind: 'life' },
    { start: '14:00', end: '17:00', title: 'Block C — 180 min', detail: 'Optional (Sociology) — the whole slot, every Saturday. Never moved, never shortened.', kind: 'study' },
    { start: '17:00', end: '19:00', title: 'Leave the room', detail: 'Mandatory.', kind: 'life' },
    { start: '19:00', end: '21:00', title: 'Block D — 120 min', kind: 'study' },
    { start: '21:00', end: '22:00', title: 'Dinner', kind: 'life' },
    { start: '22:00', end: '23:00', title: 'Block E — 60 min', detail: "Week's revision queue.", kind: 'study' },
  ],
}

export const SUNDAY: DayRoutine = {
  key: 'sunday',
  label: 'Sunday · Test & audit',
  studyLoad: '10h study',
  rows: [
    { start: '07:00', end: '09:15', title: 'Slow start', detail: "You've earned it.", kind: 'life' },
    { start: '09:30', end: '11:30', title: 'Full mock — exam timing', detail: 'Same clock as the real paper, every single week.', kind: 'study' },
    { start: '11:30', end: '14:00', title: 'Analysis — 150 min', detail: 'Worth more than the test. Every wrong answer classified.', kind: 'study' },
    { start: '14:00', end: '15:00', title: 'Lunch, rest', kind: 'life' },
    { start: '15:00', end: '18:00', title: 'Weekly current affairs — 180 min', detail: "The week's digest, mapped onto syllabus topics.", kind: 'study' },
    { start: '18:00', end: '20:00', title: 'Off. Completely.', kind: 'life' },
    { start: '20:00', end: '22:30', title: 'Weak-area repair — 150 min', detail: 'Driven by the mock, not by what you feel like doing.', kind: 'study' },
  ],
}

/** 0=Sunday … 6=Saturday, in IST. */
export function routineFor(dowIST: number): DayRoutine {
  if (dowIST === 0) return SUNDAY
  if (dowIST === 6) return SATURDAY
  return WEEKDAY
}

export const MVD_NOTE =
  'The minimum viable day: on the worst days, Block A and Block C only — two hours forty. Never zero. Streaks break on the day after a zero, not on hard days.'

export const SLEEP_NOTE =
  'If mock scores plateau or revision feels foggy, cut Block C, not sleep. Friday nights go to 7½ hours, no alarm.'

export function toMin(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
}
