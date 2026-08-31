/**
 * Stage ladder shared by the coverage grid and topic detail.
 * unread → reading → read are set by hand in v1; R1–R4 and mains belong to
 * the revision ladder engine (v2) and are display-only until it exists.
 */
export const STAGES = ['unread', 'reading', 'read', 'R1', 'R2', 'R3', 'R4', 'mains'] as const
export type Stage = (typeof STAGES)[number]

export const MANUAL_STAGES = ['unread', 'reading', 'read'] as const

export const STAGE_BG: Record<Stage, string> = {
  unread: 'bg-stone-200 dark:bg-stone-600', // warm — cool grey looks dirty on the warm bg

  reading: 'bg-amber-400',
  read: 'bg-emerald-300',
  R1: 'bg-emerald-400',
  R2: 'bg-emerald-500',
  R3: 'bg-emerald-600',
  R4: 'bg-emerald-700',
  mains: 'bg-emerald-900',
}

/** Text colour that stays legible on each stage chip in BOTH themes: the
 *  light stage backgrounds (amber, pale emerald) keep dark text even in dark
 *  mode, because the chip itself stays light. */
export const STAGE_TEXT: Record<Stage, string> = {
  unread: 'text-ink',
  reading: 'text-stone-900',
  read: 'text-stone-900',
  R1: 'text-stone-900',
  R2: 'text-white',
  R3: 'text-white',
  R4: 'text-white',
  mains: 'text-white',
}

export function isStage(v: string): v is Stage {
  return (STAGES as readonly string[]).includes(v)
}
