'use server'

import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { attempts, questions, questionTopics, revisionEvents, topics } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { addDaysISO, todayIST } from '@/lib/dates'
import { SHORTENED_NEXT_DAYS } from '@/lib/ladder'
import { CONFIDENCE } from '@/lib/practice'

/**
 * Records one attempt. A wrong answer must carry a reason code — the caller
 * enforces it in the UI, and this refuses it too, because an uncoded mistake
 * is a mistake that teaches nothing.
 */
export async function recordAttempt(input: {
  questionId: number
  chosen: string
  confidence: string
  reasonCode: number | null
  seconds: number | null
}) {
  if (!(await isAuthed())) return { ok: false as const }

  const { questionId, chosen, confidence } = input
  if (!['a', 'b', 'c', 'd'].includes(chosen)) return { ok: false as const }
  if (!(CONFIDENCE as readonly string[]).includes(confidence)) return { ok: false as const }

  const [q] = await db
    .select({ id: questions.id, answer: questions.answer })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1)
  if (!q) return { ok: false as const }

  const isCorrect = q.answer === chosen
  const reasonCode = isCorrect ? null : input.reasonCode
  if (!isCorrect && !(reasonCode && reasonCode >= 1 && reasonCode <= 6)) return { ok: false as const }

  await db.insert(attempts).values({
    questionId,
    chosen,
    isCorrect,
    confidence,
    seconds: input.seconds ?? null,
    reasonCode: reasonCode ?? null,
  })

  // Feedback into the ladder: "knew but forgot" is a revision failure, not a
  // knowledge gap, so it pulls that topic's next revision closer (D23's rule).
  if (!isCorrect && reasonCode === 2) {
    const tags = await db
      .select({ topicId: questionTopics.topicId })
      .from(questionTopics)
      .where(and(eq(questionTopics.questionId, questionId), eq(questionTopics.primary, true)))
      .limit(1)
    const topicId = tags[0]?.topicId
    if (topicId) {
      const due = addDaysISO(todayIST(), SHORTENED_NEXT_DAYS)
      await db
        .update(revisionEvents)
        .set({ dueOn: due })
        .where(
          and(
            eq(revisionEvents.topicId, topicId),
            isNull(revisionEvents.completedAt),
            sql`${revisionEvents.dueOn} > ${due}`,
            sql`${revisionEvents.rung} not like 'PASS%'`,
          ),
        )
      await db.update(topics).set({ lastTouchedAt: new Date() }).where(eq(topics.id, topicId))
    }
  }

  return { ok: true as const, isCorrect, answer: q.answer }
}
