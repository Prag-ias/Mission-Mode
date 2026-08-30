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
import { and, asc, eq, sql } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { books, subjects, topics, phases, planBlocks, revisionEvents } from '../db/schema'
import { addDaysISO, daysBetween } from '../lib/dates'

type SubjectRow = { code: string; name: string; avg_6yr: number | null; target_hours: number | null; colour: string | null }
type TopicRow = {
  code: string; subject: string; name: string; source_ref: string | null
  est_minutes: number; intro_phase: number; stage: string; pyq_drills: boolean
  bonus?: boolean
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
  // Bonus topics (decision D30) live in their own file so generate-plan.mjs,
  // which reads only topics.json, cannot schedule them even on a re-plan.
  const bonusRows = read<TopicRow[]>('bonus-topics.json')
  const bookRows = read<{
    title: string; detail: string | null; tier: string; due: string | null
    price: string | null; status: string; sort: number
  }[]>('books.json')
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
    .values([...topicRows.map((t) => ({ ...t, bonus: false })), ...bonusRows.map((t) => ({ ...t, bonus: true }))].map((t) => {
      const sid = subjectId.get(t.subject)
      if (!sid) throw new Error(`topic ${t.code}: unknown subject ${t.subject}`)
      return {
        code: t.code, subjectId: sid, name: t.name, sourceRef: t.source_ref ?? null,
        estMinutes: t.est_minutes, introPhase: t.intro_phase, stage: t.stage, pyqDrills: t.pyq_drills,
        bonus: t.bonus,
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
        bonus: sql`excluded.bonus`,
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

  // Books (section 08 of the campaign plan). Status is user tracking and is
  // written on first insert only — reseeding never undoes a purchase tick.
  await db
    .insert(books)
    .values(bookRows)
    .onConflictDoUpdate({
      target: books.title,
      set: {
        detail: sql`excluded.detail`,
        tier: sql`excluded.tier`,
        due: sql`excluded.due`,
        price: sql`excluded.price`,
        sort: sql`excluded.sort`,
      },
    })

  // PASS2–4: whole-syllabus revision passes (v2). One event per topic per
  // pass, spread evenly across that phase's window so no single day floods
  // the queue. Uncompleted events follow the current phase dates on re-run;
  // completed events are never touched.
  const passes = [
    ['PASS2', 'P3'],
    ['PASS3', 'P4'],
    ['PASS4', 'P5'],
  ] as const
  // Bonus topics are excluded from the whole-syllabus passes: seeding PASS events for
  // material that was never scheduled would manufacture revision debt out of nothing.
  const allTopics = await db
    .select({ id: topics.id })
    .from(topics)
    .where(eq(topics.bonus, false))
    .orderBy(asc(topics.id))
  for (const [rung, phaseCode] of passes) {
    const phase = phaseRows.find((p) => p.code === phaseCode)
    if (!phase) throw new Error(`PASS seeding: phase ${phaseCode} not in phases.json`)
    const span = daysBetween(phase.starts_on, phase.ends_on)
    const existing = new Map(
      (
        await db
          .select({ id: revisionEvents.id, topicId: revisionEvents.topicId, dueOn: revisionEvents.dueOn, completedAt: revisionEvents.completedAt })
          .from(revisionEvents)
          .where(eq(revisionEvents.rung, rung))
      ).map((e) => [e.topicId, e]),
    )
    const inserts: { topicId: number; rung: string; dueOn: string }[] = []
    for (let i = 0; i < allTopics.length; i++) {
      const dueOn = addDaysISO(
        phase.starts_on,
        Math.min(span, Math.floor((i * (span + 1)) / allTopics.length)),
      )
      const row = existing.get(allTopics[i].id)
      if (!row) inserts.push({ topicId: allTopics[i].id, rung, dueOn })
      else if (!row.completedAt && row.dueOn !== dueOn)
        await db.update(revisionEvents).set({ dueOn }).where(eq(revisionEvents.id, row.id))
    }
    for (let i = 0; i < inserts.length; i += 200) {
      await db.insert(revisionEvents).values(inserts.slice(i, i + 200))
    }
  }

  const count = async (t: PgTable) =>
    Number((await db.select({ n: sql<number>`count(*)` }).from(t))[0].n)
  const passCount = Number(
    (
      await db
        .select({ n: sql<number>`count(*)` })
        .from(revisionEvents)
        .where(and(sql`${revisionEvents.rung} like 'PASS%'`))
    )[0].n,
  )
  console.log(
    `seeded — subjects ${await count(subjects)} · topics ${await count(topics)} · phases ${await count(phases)} · plan blocks ${await count(planBlocks)} · pass events ${passCount}`,
  )

  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
