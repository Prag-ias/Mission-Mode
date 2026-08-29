#!/usr/bin/env node
/**
 * Sarthi — plan generator
 *
 * Seeds plan_block rows for every day from 31 Aug 2026 to 23 May 2027 (and on to
 * Mains if you pass --mains). Decision Q6: the plan is seeded upfront so the
 * coverage map is honest from day one, then re-planned weekly by re-running this
 * with --from <date>, which leaves completed blocks untouched.
 *
 *   node scripts/generate-plan.mjs                 → seed/plan-blocks.json
 *   node scripts/generate-plan.mjs --from 2026-11-02 --existing seed/plan-blocks.json
 *   node scripts/generate-plan.mjs --mains
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'seed', f), 'utf8'))

const topics  = read('topics.json')
const phases  = read('phases.json')
const slots   = read('slots.json')

const args = process.argv.slice(2)
const argOf = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const FROM     = argOf('--from')
const MAINS    = args.includes('--mains')
const EXISTING = argOf('--existing')

const PRELIMS = '2027-05-23'
const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x }

// ---------------------------------------------------------------- topic queues
// One queue per subject, ordered by intro_phase then declaration order. The
// generator consumes est_minutes off the head of a queue and splits a topic
// across consecutive blocks when it is longer than the slot.
const queues = {}
for (const t of topics) {
  ;(queues[t.subject] ??= []).push({ ...t, remaining: t.est_minutes, part: 0 })
}
for (const k of Object.keys(queues)) queues[k].sort((a, b) => a.intro_phase - b.intro_phase)

function take(subject, minutes, phaseIdx) {
  const q = queues[subject]
  if (!q?.length) return null
  const head = q.find((t) => t.intro_phase <= phaseIdx + 1 && t.remaining > 0) ?? q.find((t) => t.remaining > 0)
  if (!head) return null
  const used = Math.min(head.remaining, minutes)
  head.remaining -= used
  head.part += 1
  if (head.remaining <= 0) q.splice(q.indexOf(head), 1)
  return {
    topic_code: head.code,
    subject,
    label: head.part > 1 || head.remaining > 0 ? `${head.name} (part ${head.part})` : head.name,
    source_ref: head.source_ref,
    planned_minutes: used,
  }
}

// Round-robin picker so a phase with ["ENV","ANM","ART"] in slot B cycles them.
const cursors = {}
function pick(list, key) {
  if (!list?.length) return null
  cursors[key] = (cursors[key] ?? -1) + 1
  return list[cursors[key] % list.length]
}

// ------------------------------------------------------------------ generation
const blocks = []
let idn = 1

function emit(date, slot, phase, payload) {
  blocks.push({
    id: idn++,
    date,
    slot: slot.code,
    start: slot.start,
    minutes: slot.minutes,
    kind: slot.kind,
    phase: phase.code,
    status: 'planned',
    actual_minutes: null,
    ...payload,
  })
}

// Non-content slots become fixed rituals rather than topics.
const RITUAL = {
  REVISION: { label: 'Revision queue — most overdue first', subject: null, topic_code: null },
  PYQ:      { label: 'PYQ drill — topic-wise, 20 questions', subject: null, topic_code: null },
  MOCK:     { label: 'Full mock at exam timing', subject: null, topic_code: null },
  MAINS_GS: { label: 'Mains GS — the 30% Prelims did not cover', subject: null, topic_code: null },
  ANSWER_WRITING: { label: 'Answer writing under time', subject: null, topic_code: null },
  ESSAY:    { label: 'Essay — one per week, evaluated', subject: null, topic_code: null },
}

function fill(date, slot, phase, choices, key) {
  const want = pick(choices, key)
  if (!want) return
  if (RITUAL[want]) return emit(date, slot, phase, { ...RITUAL[want], planned_minutes: slot.minutes })
  const t = take(want, slot.minutes, phases.indexOf(phase))
  emit(date, slot, phase, t
    ? t
    : { label: `${want} — revision / spare capacity`, subject: want, topic_code: null, planned_minutes: slot.minutes })
}

for (const [pi, phase] of phases.entries()) {
  if (phase.code === 'P6' && !MAINS) continue
  let d = new Date(phase.starts_on + 'T00:00:00Z')
  const end = new Date(phase.ends_on + 'T00:00:00Z')
  while (d <= end) {
    const date = iso(d)
    const dow = d.getUTCDay() // 0 Sun .. 6 Sat
    if (dow === 0) {
      for (const s of slots.sunday) {
        // Phase 0 has nothing worth mocking yet: the test slots become a self-test
        // on the week's own chapters, which is what actually builds the habit.
        const label =
          phase.code === 'P0' && (s.kind === 'mock' || s.kind === 'analysis')
            ? (s.kind === 'mock'
                ? 'Self-test on this week\u2019s chapters \u2014 write questions, then answer them'
                : 'Review the self-test; rewrite any note that failed')
            : s.label
        const subject = s.kind === 'ca' ? 'CAI' : null
        emit(date, s, phase, { label, subject, topic_code: null, planned_minutes: s.minutes })
      }
    } else if (dow === 6) {
      fill(date, slots.saturday[0], phase, phase.slotA, phase.code + ':SA')
      fill(date, slots.saturday[1], phase, phase.satB,  phase.code + ':SB')
      // SC is locked to the optional from 1 Oct 2026 onward. Never moved.
      const sc = slots.saturday[2]
      const scSubject = date >= '2026-10-01' ? (phase.satC ?? ['SOC']) : ['GEO']
      fill(date, sc, phase, scSubject, phase.code + ':SC')
      fill(date, slots.saturday[3], phase, phase.satD, phase.code + ':SD')
      emit(date, slots.saturday[4], phase, { ...RITUAL.REVISION, planned_minutes: 60 })
    } else {
      fill(date, slots.weekday[0], phase, phase.slotA, phase.code + ':A')
      fill(date, slots.weekday[1], phase, phase.slotB, phase.code + ':B')
      emit(date, slots.weekday[2], phase, { ...RITUAL.REVISION, planned_minutes: 70 })
    }
    d = addDays(d, 1)
  }
}

// ------------------------------------------------------- weekly re-plan support
let out = blocks
if (FROM && EXISTING) {
  const prior = JSON.parse(fs.readFileSync(path.join(root, EXISTING), 'utf8'))
  const kept = prior.filter((b) => b.date < FROM)          // history is immutable
  const fresh = blocks.filter((b) => b.date >= FROM)
  out = [...kept, ...fresh].map((b, i) => ({ ...b, id: i + 1 }))
  console.log(`re-plan: kept ${kept.length} historical blocks, regenerated ${fresh.length} from ${FROM}`)
}

fs.writeFileSync(path.join(root, 'seed/plan-blocks.json'), JSON.stringify(out, null, 1))

// ------------------------------------------------------------------- reporting
const toPrelims = out.filter((b) => b.date <= PRELIMS)
const hours = toPrelims.reduce((a, b) => a + b.planned_minutes, 0) / 60
const bySubject = {}
for (const b of toPrelims) if (b.subject) bySubject[b.subject] = (bySubject[b.subject] ?? 0) + b.planned_minutes
const unfinished = Object.entries(queues).filter(([, q]) => q.some((t) => t.remaining > 0))

console.log(`\nblocks to Prelims : ${toPrelims.length}`)
console.log(`planned hours     : ${hours.toFixed(0)}  (at 85% adherence ≈ ${(hours * 0.85).toFixed(0)} effective)`)
console.log(`\nhours by subject:`)
for (const [s, m] of Object.entries(bySubject).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${s.padEnd(5)} ${(m / 60).toFixed(0).padStart(5)} h`)
}
if (unfinished.length) {
  console.log(`\n⚠ topics with unread minutes left at Prelims:`)
  for (const [s, q] of unfinished) {
    const left = q.reduce((a, t) => a + t.remaining, 0)
    console.log(`  ${s.padEnd(5)} ${q.filter((t) => t.remaining > 0).length} topics, ${(left / 60).toFixed(0)} h`)
  }
} else {
  console.log('\n✓ every topic gets its full first reading before 23 May')
}
