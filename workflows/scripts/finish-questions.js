export const meta = {
  name: 'finish-questions',
  description: 'Explain and tag questions whose answers are already known',
  phases: [
    { title: 'Explain', detail: 'justify the official answer' },
    { title: 'Tag', detail: 'assign format and topic codes' },
  ],
}

const QUESTIONS = args.questions
const YEAR = args.year
const PAPER = args.paper
const IS_CSAT = PAPER === 'CSAT'

const EXPLAIN_SCHEMA = {
  type: 'object',
  required: ['explanation_md'],
  properties: { explanation_md: { type: 'string' } },
}

const FORMATS = ['simple', 'stmt_1_2', 'stmt_1_2_3', 'pairs', 'match_list', 'relationship', 'conclusion_count', 'assertion_basis', 'case_study', 'identify']

const TAG_SCHEMA = {
  type: 'object',
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['q_no', 'format', 'topic_codes'],
        properties: {
          q_no: { type: 'integer' },
          format: { type: 'string', enum: FORMATS },
          topic_codes: { type: 'array', items: { type: 'string' }, minItems: 1 },
          tagging_note: { type: 'string' },
        },
      },
    },
  },
}

phase('Explain')
// One agent per question, and the question number comes from the closure, never
// from the model: an agent given a single item numbers it 1.
const explained = await parallel(
  QUESTIONS.map((q) => () =>
    agent(
      `Write the explanation for one UPSC ${PAPER} ${YEAR} question. The official answer is already known and is what the app will display, so justify THAT answer.\n\n` +
        `Official answer: ${q.answer}\n\n` +
        `Question:\n${q.stem}\n\nOptions:\n${q.options.map((o, i) => `${'abcd'[i]}) ${o}`).join('\n')}\n\n` +
        (q.has_figure
          ? `NOTE: this question depends on a figure that is described in words here rather than shown: ${q.note ?? '(no description)'}\nReason from that description. If the description is not sufficient to derive the official answer with confidence, say so plainly in the explanation rather than inventing a derivation.\n\n`
          : ``) +
        `Show the actual working — for numeracy and reasoning, do the arithmetic or the logic step by step and arrive at the answer; for comprehension, quote the deciding line. Then say briefly why the tempting alternative fails.\n` +
        `Write it as the explanation a candidate reads at 21:40 while revising: specific, worked, short enough to absorb. Markdown; bold the deciding step.`,
      { label: `explain:Q${q.q_no}`, phase: 'Explain', schema: EXPLAIN_SCHEMA },
    ).then((r) => ({ q_no: q.q_no, explanation_md: r?.explanation_md ?? null })),
  ),
)

phase('Tag')
const tagged = await agent(
  `Tag these UPSC ${PAPER} ${YEAR} questions for a study app.\n\n` +
    (IS_CSAT
      ? `topic_codes must come from exactly this list:\n` +
        `CSA-01 Comprehension — passage strategy and elimination under time\n` +
        `CSA-02 Logical reasoning and analytical ability\n` +
        `CSA-03 Basic numeracy — numbers, ratio, percentage, time-work, time-distance\n` +
        `CSA-04 Data interpretation — charts, tables, data sufficiency\n` +
        `CSA-05 Decision making and problem solving\n` +
        `Do NOT use CSA-06. Usually one code; two only when genuinely both apply.\n\n`
      : `Read C:/Users/KIIT/Mission 2027/Sarthi/seed/topics.json for the topic vocabulary and use only codes that literally exist in it.\n\n`) +
    `format is one of: ${FORMATS.join(', ')}.\n\n` +
    JSON.stringify(QUESTIONS.map((q) => ({ q_no: q.q_no, stem: q.stem.slice(0, 1200), options: q.options }))) +
    `\n\nReturn via StructuredOutput.`,
  { label: `tag:${YEAR}`, phase: 'Tag', schema: TAG_SCHEMA, effort: 'low' },
)

const explBy = new Map(explained.filter(Boolean).map((e) => [e.q_no, e.explanation_md]))
const tagBy = new Map((tagged?.questions ?? []).map((t) => [t.q_no, t]))

const merged = QUESTIONS.map((q) => {
  const t = tagBy.get(q.q_no)
  const codes = t?.topic_codes?.length ? t.topic_codes : IS_CSAT ? ['CSA-01'] : null
  return {
    ...q,
    answer_source: 'official',
    dropped_by_upsc: false,
    explanation_md: explBy.get(q.q_no) ?? null,
    format: t?.format ?? 'simple',
    subject_code: IS_CSAT ? 'CSAT' : null,
    topic_codes: codes,
    primary_topic_code: codes?.[0] ?? null,
    tagging_note: t?.tagging_note ?? null,
    review_flag: null,
  }
})

log(`${merged.length} finished; ${merged.filter((m) => m.explanation_md).length} explained`)
return { paper: PAPER, year: YEAR, agreement: { agree: 0, scored: 0 }, tagging_notes: [], questions: merged }
