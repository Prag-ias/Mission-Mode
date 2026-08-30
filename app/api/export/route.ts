import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  attempts, books, caItems, dailyLogs, notes, phases, planBlocks,
  questions, questionTopics, revisionEvents, subjects, testSubjects, tests, topics,
} from '@/db/schema'
import { isAuthed } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * One button, all data as JSON — insurance against my own database.
 *
 * Deliberately sequential: the whole export reads in ~half a second, and a
 * 13-way Promise.all over a small connection pool is exactly the shape that
 * wedged this app once before. Boring and ordered beats clever and stuck.
 */
export async function GET() {
  if (!(await isAuthed())) return new NextResponse('unauthorised', { status: 401 })

  const body = {
    exported_at: new Date().toISOString(),
    subjects: await db.select().from(subjects),
    topics: await db.select().from(topics),
    phases: await db.select().from(phases),
    plan_blocks: await db.select().from(planBlocks),
    daily_logs: await db.select().from(dailyLogs),
    notes: await db.select().from(notes),
    revision_events: await db.select().from(revisionEvents),
    questions: await db.select().from(questions),
    question_topics: await db.select().from(questionTopics),
    attempts: await db.select().from(attempts),
    tests: await db.select().from(tests),
    test_subjects: await db.select().from(testSubjects),
    ca_items: await db.select().from(caItems),
    books: await db.select().from(books),
  }

  return NextResponse.json(body, {
    headers: {
      'Content-Disposition': `attachment; filename="sarthi-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
