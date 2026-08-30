/**
 * Sarthi — Drizzle schema (Postgres / Supabase)
 *
 * Single user. No users table, no orgs, no row-level tenancy — see NG1 in the PRD.
 * The `topics` table is the spine: a mock result reaches the revision queue through it.
 */
import {
  pgTable, serial, integer, smallint, text, varchar, boolean,
  date, timestamp, jsonb, real, uniqueIndex, index,
} from 'drizzle-orm/pg-core'

export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 8 }).notNull().unique(),   // POL, GEO, SOC…
  name: text('name').notNull(),
  avg6yr: real('avg_6yr'),                                   // mean questions/year 2021–26
  targetHours: integer('target_hours'),
  colour: varchar('colour', { length: 9 }),
})

export const topics = pgTable('topics', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 16 }).notNull().unique(),  // POL-07
  subjectId: integer('subject_id').references(() => subjects.id).notNull(),
  parentId: integer('parent_id'),
  name: text('name').notNull(),
  sourceRef: text('source_ref'),                             // "Laxmikanth Ch.7"
  estMinutes: integer('est_minutes').notNull(),
  introPhase: smallint('intro_phase').notNull(),
  /** unread | reading | read | R1 | R2 | R3 | R4 | mains */
  stage: varchar('stage', { length: 10 }).notNull().default('unread'),
  pyqDrills: boolean('pyq_drills').notNull().default(true),  // false for Sociology (decision Q3)
  /** true = bonus topic: tagged and drillable, but never scheduled by the planner (decision D30) */
  bonus: boolean('bonus').notNull().default(false),
  firstReadAt: timestamp('first_read_at', { withTimezone: true }),
  lastTouchedAt: timestamp('last_touched_at', { withTimezone: true }),
}, (t) => ({ bySubject: index('topics_subject_idx').on(t.subjectId) }))

export const phases = pgTable('phases', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 4 }).notNull().unique(),
  name: text('name').notNull(),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  weeklyHours: integer('weekly_hours').notNull(),
  note: text('note'),
})

export const planBlocks = pgTable('plan_blocks', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  slot: varchar('slot', { length: 4 }).notNull(),            // A B C SA SB SC SD SE U1..U4
  start: varchar('start', { length: 5 }).notNull(),
  kind: varchar('kind', { length: 12 }).notNull(),           // deep revision optional mock analysis ca repair
  phaseCode: varchar('phase_code', { length: 4 }).notNull(),
  topicId: integer('topic_id').references(() => topics.id),
  subjectId: integer('subject_id').references(() => subjects.id),
  label: text('label').notNull(),
  sourceRef: text('source_ref'),
  plannedMinutes: integer('planned_minutes').notNull(),
  actualMinutes: integer('actual_minutes'),
  /** planned | done | skipped | rescheduled */
  status: varchar('status', { length: 12 }).notNull().default('planned'),
  rescheduleCount: smallint('reschedule_count').notNull().default(0), // decision Q4: max 2
  loggedAt: timestamp('logged_at', { withTimezone: true }),
  backdated: boolean('backdated').notNull().default(false),
}, (t) => ({ byDate: uniqueIndex('plan_blocks_date_slot_idx').on(t.date, t.slot) }))

export const dailyLogs = pgTable('daily_logs', {
  date: date('date').primaryKey(),
  totalMinutes: integer('total_minutes').notNull().default(0),
  mvdMet: boolean('mvd_met').notNull().default(false),        // >= 160 minutes
  streakCount: integer('streak_count').notNull().default(0),
  energy: smallint('energy'),                                 // optional 1–3
  note: text('note'),
})

export const notes = pgTable('notes', {
  id: serial('id').primaryKey(),
  topicId: integer('topic_id').references(() => topics.id).notNull(),
  bodyMd: text('body_md').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({ byTopic: index('notes_topic_idx').on(t.topicId) }))

export const revisionEvents = pgTable('revision_events', {
  id: serial('id').primaryKey(),
  topicId: integer('topic_id').references(() => topics.id).notNull(),
  /** D1 | D7 | D30 | D90 | PASS2 | PASS3 | PASS4 */
  rung: varchar('rung', { length: 6 }).notNull(),
  dueOn: date('due_on').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  recallScore: smallint('recall_score'),                      // 1–3, D1 blind recall only
}, (t) => ({ byDue: index('revision_due_idx').on(t.dueOn, t.completedAt) }))

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  year: smallint('year').notNull(),
  paper: varchar('paper', { length: 4 }).notNull(),           // GS1 | CSAT
  qNo: smallint('q_no').notNull(),
  stem: text('stem').notNull(),
  options: jsonb('options').notNull(),                        // string[4]
  answer: varchar('answer', { length: 1 }),                   // a b c d
  explanationMd: text('explanation_md'),
  subjectId: integer('subject_id').references(() => subjects.id),
  format: varchar('format', { length: 20 }).notNull().default('simple'),
  /** official | <named coaching source> | disputed  — decision Q1 */
  answerSource: varchar('answer_source', { length: 24 }).notNull().default('disputed'),
  disputed: boolean('disputed').notNull().default(false),     // excluded from accuracy stats
}, (t) => ({ byYear: uniqueIndex('questions_year_paper_q_idx').on(t.year, t.paper, t.qNo) }))

/** Questions straddle topics — 2026's Green Hydrogen question is S&T, Environment and Economy at once. */
export const questionTopics = pgTable('question_topics', {
  questionId: integer('question_id').references(() => questions.id).notNull(),
  topicId: integer('topic_id').references(() => topics.id).notNull(),
  primary: boolean('primary').notNull().default(false),
}, (t) => ({ pk: uniqueIndex('question_topics_pk').on(t.questionId, t.topicId) }))

export const attempts = pgTable('attempts', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id').references(() => questions.id).notNull(),
  chosen: varchar('chosen', { length: 1 }),
  isCorrect: boolean('is_correct').notNull(),
  confidence: varchar('confidence', { length: 6 }),           // sure | unsure | guess
  seconds: integer('seconds'),
  reasonCode: smallint('reason_code'),                        // 1–6, null when correct
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow(),
}, (t) => ({ byQuestion: index('attempts_question_idx').on(t.questionId) }))

export const tests = pgTable('tests', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  source: text('source'),                                     // Forum IAS, PYQ 2024, Insights…
  kind: varchar('kind', { length: 10 }).notNull(),            // sectional | full | pyq_paper | csat
  attempted: smallint('attempted'),
  correct: smallint('correct'),
  score: real('score'),
  notesMd: text('notes_md'),
})

export const testSubjects = pgTable('test_subjects', {
  testId: integer('test_id').references(() => tests.id).notNull(),
  subjectId: integer('subject_id').references(() => subjects.id).notNull(),
  attempted: smallint('attempted'),
  correct: smallint('correct'),
}, (t) => ({ pk: uniqueIndex('test_subjects_pk').on(t.testId, t.subjectId) }))

/** The closed source list from the campaign plan (section 08). Status is the
 *  user's tracking — owned, still to buy, or use the free PDF — and survives
 *  reseeds the way topic stages do. */
export const books = pgTable('books', {
  id: serial('id').primaryKey(),
  title: text('title').notNull().unique(),
  detail: text('detail'),
  tier: varchar('tier', { length: 12 }).notNull(),   // owned | tier1 | tier2 | sociology | tier3
  due: text('due'),
  price: text('price'),
  /** owned | to_buy | pdf */
  status: varchar('status', { length: 8 }).notNull().default('to_buy'),
  sort: integer('sort').notNull().default(0),
})

export const caItems = pgTable('ca_items', {
  id: serial('id').primaryKey(),
  capturedOn: date('captured_on').notNull(),
  headline: text('headline').notNull(),
  summary: text('summary'),
  url: text('url'),
  topicIds: jsonb('topic_ids'),                               // number[]
  bgtDone: boolean('bgt_done').notNull().default(false),      // bio-geo-tech drill applied
})
