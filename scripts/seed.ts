/**
 * Loads seed/*.json into Postgres. Idempotent — safe to re-run any time.
 *
 * On conflict only plan/content fields are updated. Log and progress fields
 * (plan_blocks.status/actual_minutes/logged_at, topics.stage/timestamps) are
 * written on first insert only, so re-seeding after a weekly re-plan can
 * never clobber logged history.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { subjects, topics, phases, planBlocks } from '../db/schema'

type SubjectRow = { code: string; name: string; avg_6yr: number | null; target_hours: number | null; colour: string | null }
type TopicRow = {
  code: string; subject: string; name: string; source_ref: string | null
  est_minutes: number; intro_phase: number; stage: string; pyq_drills: boolean
}
type PhaseRow = { code: string; name: string; starts_on: string; ends_on: string; weekly_hours: number; note?: string }
type BlockRow = {
  date: string; slot: string; start: string; kind: string; phase: string
  topic_code: string | null; subject: string | null; label: string
  source_ref?: string | null; planned_minutes: number
}

const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'seed', f), 'utf8'))

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set — put it in .env.local')
  const client = postgres(url, { prepare: false, max: 1 })
  const db = drizzle(client)

  const subjectRows = read<SubjectRow[]>('subjects.json')
  const topicRows = read<TopicRow[]>('topics.json')
  const phaseRows = read<PhaseRow[]>('phases.json')
  const blockRows = read<BlockRow[]>('plan-blocks.json')

  await db
    .insert(subjects)
    .values(subjectRows.map((s) => ({
      code: s.code, name: s.name, avg6yr: s.avg_6yr, targetHours: s.target_hours, colour: s.colour,
    })))
    .onConflictDoUpdate({
      target: subjects.code,
      set: {
        name: sql`excluded.name`,
        avg6yr: sql`excluded.avg_6yr`,
        targetHours: sql`excluded.target_hours`,
        colour: sql`excluded.colour`,
      },
    })

  const subjectId = new Map((await db.select().from(subjects)).map((s) => [s.code, s.id]))

  await db
    .insert(topics)
    .values(topicRows.map((t) => {
      const sid = subjectId.get(t.subject)
      if (!sid) throw new Error(`topic ${t.code}: unknown subject ${t.subject}`)
      return {
        code: t.code, subjectId: sid, name: t.name, sourceRef: t.source_ref ?? null,
        estMinutes: t.est_minutes, introPhase: t.intro_phase, stage: t.stage, pyqDrills: t.pyq_drills,
      }
    }))
    .onConflictDoUpdate({
      target: topics.code,
      set: {
        subjectId: sql`excluded.subject_id`,
        name: sql`excluded.name`,
        sourceRef: sql`excluded.source_ref`,
        estMinutes: sql`excluded.est_minutes`,
        introPhase: sql`excluded.intro_phase`,
        pyqDrills: sql`excluded.pyq_drills`,
      },
    })

  const topicId = new Map((await db.select().from(topics)).map((t) => [t.code, t.id]))

  await db
    .insert(phases)
    .values(phaseRows.map((p) => ({
      code: p.code, name: p.name, startsOn: p.starts_on, endsOn: p.ends_on,
      weeklyHours: p.weekly_hours, note: p.note ?? null,
    })))
    .onConflictDoUpdate({
      target: phases.code,
      set: {
        name: sql`excluded.name`,
        startsOn: sql`excluded.starts_on`,
        endsOn: sql`excluded.ends_on`,
        weeklyHours: sql`excluded.weekly_hours`,
        note: sql`excluded.note`,
      },
    })

  const blockValues = blockRows.map((b) => {
    const tid = b.topic_code ? topicId.get(b.topic_code) : null
    if (b.topic_code && !tid) throw new Error(`block ${b.date} ${b.slot}: unknown topic ${b.topic_code}`)
    const sid = b.subject ? subjectId.get(b.subject) : null
    if (b.subject && !sid) throw new Error(`block ${b.date} ${b.slot}: unknown subject ${b.subject}`)
    return {
      date: b.date, slot: b.slot, start: b.start, kind: b.kind, phaseCode: b.phase,
      topicId: tid ?? null, subjectId: sid ?? null, label: b.label,
      sourceRef: b.source_ref ?? null, plannedMinutes: b.planned_minutes,
    }
  })
  for (let i = 0; i < blockValues.length; i += 200) {
    await db
      .insert(planBlocks)
      .values(blockValues.slice(i, i + 200))
      .onConflictDoUpdate({
        target: [planBlocks.date, planBlocks.slot],
        set: {
          start: sql`excluded.start`,
          kind: sql`excluded.kind`,
          phaseCode: sql`excluded.phase_code`,
          topicId: sql`excluded.topic_id`,
          subjectId: sql`excluded.subject_id`,
          label: sql`excluded.label`,
          sourceRef: sql`excluded.source_ref`,
          plannedMinutes: sql`excluded.planned_minutes`,
        },
      })
  }

  const count = async (t: PgTable) =>
    Number((await db.select({ n: sql<number>`count(*)` }).from(t))[0].n)
  console.log(
    `seeded — subjects ${await count(subjects)} · topics ${await count(topics)} · phases ${await count(phases)} · plan blocks ${await count(planBlocks)}`,
  )

  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
