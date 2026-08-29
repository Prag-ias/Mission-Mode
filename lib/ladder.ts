/**
 * The revision ladder. A topic that reaches `read` gets four scheduled
 * touches; completing a touch advances the stage, never backwards.
 */
import { STAGES, type Stage } from '@/lib/stages'

export const RUNG_INTERVALS = { D1: 1, D7: 7, D30: 30, D90: 90 } as const
export type DRung = keyof typeof RUNG_INTERVALS

export const RUNG_STAGE: Record<DRung, Stage> = { D1: 'R1', D7: 'R2', D30: 'R3', D90: 'R4' }

export function isDRung(rung: string): rung is DRung {
  return rung in RUNG_INTERVALS
}

/** true when `next` is further up the ladder than `current` */
export function advances(current: string, next: Stage): boolean {
  return STAGES.indexOf(next) > STAGES.indexOf(current as Stage)
}

/** Queue cap — beyond this, items are debt, not list. */
export const QUEUE_CAP = 12

/** A blind recall scored 1 pulls the next touch this close (days). */
export const SHORTENED_NEXT_DAYS = 3

/** Missed blocks ride along for this many days, then become debt. */
export const CARRY_DAYS = 2
