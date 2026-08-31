export const meta = {
  name: 'ingest-csat-paper',
  description: 'Transcribe, solve, key and tag one CSAT (GS Paper 2) year',
  phases: [
    { title: 'Transcribe', detail: 'read English pages; every stem must be self-contained' },
    { title: 'Solve', detail: 'solve blind with worked reasoning, before seeing the key' },
    { title: 'Key', detail: 'read the official answer key' },
    { title: 'Tag', detail: 'assign format and CSAT topic codes' },
    { title: 'Reconcile', detail: 'rewrite explanations that argue against the official key' },
  ],
}

const YEAR = args.year
const KEY_FILE = args.keyFile
const DIR = `C:/Users/KIIT/Mission 2027/Sarthi/.ingest/pages/csat_${YEAR}`
const BATCHES = args.batches.map((pages, i) => ({ id: `B${i + 1}`, pages }))
const pathsFor = (b) => b.pages.map((p) => `${DIR}/p-${String(p).padStart(2, '0')}.png`).join('\n')

const Q_ITEMS = {
  type: 'array',
  items: {
    type: 'object',
    required: ['q_no', 'page', 'stem', 'options'],
    properties: {
      q_no: { type: 'integer' },
      page: { type: 'integer' },
      stem: {
        type: 'string',
        description:
          'SELF-CONTAINED. If the question depends on a passage or shared data set, the full passage/data must be reproduced inside this stem.',
      },
      options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
      shares_passage_with: { type: 'array', items: { type: 'integer' } },
      has_figure: { type: 'boolean' },
      has_table: { type: 'boolean' },
      incomplete: { type: 'boolean' },
      note: { type: 'string' },
    },
  },
}

const TRANSCRIBE_SCHEMA = {
  type: 'object',
  required: ['batch', 'questions'],
  properties: {
    batch: { type: 'string' },
    pages_with_questions: { type: 'array', items: { type: 'integer' } },
    questions: Q_ITEMS,
  },
}

const SOLVE_SCHEMA = {
  type: 'object',
  required: ['solutions'],
  properties: {
    solutions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['q_no', 'answer', 'confidence', 'explanation_md'],
        properties: {
          q_no: { type: 'integer' },
          answer: { type: 'string', enum: ['a', 'b', 'c', 'd'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          explanation_md: {
            type: 'string',
            description:
              'Worked solution. For numeracy/DI/reasoning show the actual working and arrive at the number. For comprehension, quote the deciding line and say why each distractor fails.',
          },
        },
      },
    },
  },
}

const KEY_SCHEMA = {
  type: 'object',
  required: ['answers'],
  properties: {
    booklet_series: { type: 'string' },
    dropped: { type: 'array', items: { type: 'integer' } },
    answers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['q_no', 'answer'],
        properties: { q_no: { type: 'integer' }, answer: { type: 'string' } },
      },
    },
  },
}

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
          format: {
            type: 'string',
            enum: ['simple', 'stmt_1_2', 'stmt_1_2_3', 'pairs', 'match_list', 'relationship', 'conclusion_count', 'assertion_basis', 'case_study', 'identify'],
          },
          topic_codes: { type: 'array', items: { type: 'string' }, minItems: 1 },
        },
      },
    },
  },
}

phase('Transcribe')
const transcribed = await parallel(
  BATCHES.map((b) => () =>
    agent(
      `Transcribe the UPSC CSAT ${YEAR} (General Studies Paper II) questions from these English scan pages. Read every image with the Read tool:\n${pathsFor(b)}\n\n` +
        `Rules:\n` +
        `- Transcribe VERBATIM. Do not paraphrase, correct, or shorten anything.\n` +
        `- CRITICAL: each stem must be SELF-CONTAINED. CSAT comprehension passages serve several questions, and the app shows one question at a time, so reproduce the full passage inside the stem of EVERY question that needs it, followed by the question line itself. Same for a shared table or data set. Also list the other q_nos in shares_passage_with.\n` +
        `- Preserve numbered statements, tables (as markdown) and mathematical expressions exactly.\n` +
        `- Options are exactly four, in order a,b,c,d, WITHOUT the letter prefix.\n` +
        `- If a question depends on a figure you cannot read, still transcribe it, set has_figure true and explain in note.\n` +
        `- Set incomplete true rather than inventing any missing text.\n` +
        `Batch id: ${b.id}. Return via StructuredOutput.`,
      { label: `transcribe:${b.id}`, phase: 'Transcribe', schema: TRANSCRIBE_SCHEMA },
    ),
  ),
)
const questions = transcribed
  .filter(Boolean)
  .flatMap((r) => r.questions)
  .sort((a, b) => a.q_no - b.q_no)
log(`transcribed ${questions.length} questions`)

phase('Solve')
const CHUNK = 10
const chunks = []
for (let i = 0; i < questions.length; i += CHUNK) chunks.push(questions.slice(i, i + CHUNK))

const solvedChunks = await parallel(
  chunks.map((c, i) => () =>
    agent(
      `You are sitting UPSC CSAT ${YEAR}. Solve each question below and show your working. You have NOT seen the answer key and must not guess at what it says: derive every answer yourself.\n\n` +
        `For numeracy, data interpretation and logical reasoning: do the actual arithmetic and logic step by step and state the result. These have one provably correct answer, so get it right rather than plausible.\n` +
        `For comprehension: decide only from the passage as given, quote the deciding line, and say briefly why each other option fails.\n` +
        `For decision-making: choose what a civil servant following rules, ethics and proportionality would do.\n\n` +
        `Write explanation_md as the explanation a candidate will read at 21:40 while revising: worked, specific, short enough to absorb. Markdown, bold the key step.\n\n` +
        JSON.stringify(c.map((q) => ({ q_no: q.q_no, stem: q.stem, options: q.options }))) +
        `\n\nReturn via StructuredOutput.`,
      { label: `solve:${i + 1}`, phase: 'Solve', schema: SOLVE_SCHEMA },
    ),
  ),
)
const solutions = solvedChunks.filter(Boolean).flatMap((r) => r.solutions)

phase('Key')
const key = await agent(
  `Read the official UPSC answer key for CSAT (General Studies Paper II) ${YEAR} at:\n${KEY_FILE}\n\n` +
    `Use the Read tool; it reads both images and PDFs. Transcribe EVERY question number and its answer letter, 1 to 80, exactly as printed. Do not solve anything yourself, just read what is there.\n` +
    `If the key is laid out in columns, follow each column carefully: column drift is the most common error here. Sanity-check that you have 80 entries with no duplicates and no gaps before returning.\n` +
    `Note the booklet series if printed, and list any question marked as dropped or "full marks to all".\n` +
    `Answers must be lowercase a/b/c/d. Return via StructuredOutput.`,
  { label: `key:${YEAR}`, phase: 'Key', schema: KEY_SCHEMA, effort: 'high' },
)

phase('Tag')
const taggedChunks = await parallel(
  chunks.map((c, i) => () =>
    agent(
      `Tag these UPSC CSAT ${YEAR} questions for a study app.\n\n` +
        `topic_codes must come from exactly this list:\n` +
        `CSA-01 Comprehension — passage strategy and elimination under time\n` +
        `CSA-02 Logical reasoning and analytical ability\n` +
        `CSA-03 Basic numeracy — numbers, ratio, percentage, time-work, time-distance\n` +
        `CSA-04 Data interpretation — charts, tables, data sufficiency\n` +
        `CSA-05 Decision making and problem solving\n` +
        `Do NOT use CSA-06 (that is whole-paper practice, not a question tag). Usually one code; two only when genuinely both apply.\n\n` +
        `format is the question's shape: simple (a plain single question, which most CSAT questions are), stmt_1_2 / stmt_1_2_3 (numbered statements to judge), pairs, match_list, relationship, conclusion_count (how many conclusions follow), assertion_basis, case_study (a decision-making scenario), identify.\n\n` +
        JSON.stringify(c.map((q) => ({ q_no: q.q_no, stem: q.stem.slice(0, 1200), options: q.options }))) +
        `\n\nReturn via StructuredOutput.`,
      { label: `tag:${i + 1}`, phase: 'Tag', schema: TAG_SCHEMA, effort: 'low' },
    ),
  ),
)
const tags = taggedChunks.filter(Boolean).flatMap((r) => r.questions)

const solvedBy = new Map(solutions.map((s) => [s.q_no, s]))
const tagBy = new Map(tags.map((t) => [t.q_no, t]))
const keyBy = new Map((key?.answers ?? []).map((a) => [a.q_no, String(a.answer).toLowerCase()]))
const dropped = new Set(key?.dropped ?? [])

let agree = 0
let scored = 0
const merged = questions.map((q) => {
  const s = solvedBy.get(q.q_no)
  const t = tagBy.get(q.q_no)
  const official = keyBy.get(q.q_no) ?? null
  const isDropped = dropped.has(q.q_no)
  if (official && s && !isDropped) {
    scored++
    if (official === s.answer) agree++
  }
  return {
    ...q,
    answer: isDropped ? null : official,
    answer_source: official ? 'official' : null,
    dropped_by_upsc: isDropped,
    independent_answer: s ? { answer: s.answer, confidence: s.confidence } : null,
    explanation_md: s?.explanation_md ?? null,
    format: t?.format ?? 'simple',
    topic_codes: t?.topic_codes ?? ['CSA-01'],
    review_flag:
      official && s && official !== s.answer && !isDropped
        ? `Official key says ${official}, worked solution said ${s.answer} (${s.confidence} confidence).`
        : null,
  }
})

// A question whose explanation argues for a different letter than the one the
// app will display is worse than no explanation: it teaches the wrong answer.
// Those get re-explained from the key's side, by a fresh agent.
phase('Reconcile')
const conflicts = merged.filter((m) => m.review_flag)
if (conflicts.length) {
  // One agent, one question, and NO q_no in the schema: an agent given a single
  // item numbers it 1, which silently pasted one question's explanation onto
  // another when the result was keyed on the returned number. The question
  // number comes from the closure now, never from the model.
  const RECONCILE_SCHEMA = {
    type: 'object',
    required: ['explanation_md', 'key_defensible'],
    properties: {
      explanation_md: { type: 'string' },
      key_defensible: { type: 'boolean' },
      why: { type: 'string', description: 'if key_defensible is false, what makes the official answer look wrong' },
    },
  }
  const fixed = await parallel(
    conflicts.map((q) => () =>
      agent(
        `A UPSC CSAT ${YEAR} question where an independent solver disagreed with the official answer key. The official key is what the app will show, so the explanation must justify the OFFICIAL answer.\n\n` +
          `Official answer: ${q.answer}\nSolver's answer: ${q.independent_answer?.answer}\n\n` +
          `Question:\n${q.stem}\n\nOptions:\n${q.options.map((o, i) => `${'abcd'[i]}) ${o}`).join('\n')}\n\n` +
          `First work out honestly why UPSC's answer is the intended one — for comprehension this is usually a precise word the candidate skimmed (a compound term split apart, a quantifier like "all" or "universally", a term of art swapped for a near-synonym). Then write explanation_md defending the official answer, naming that exact distinction, and saying plainly why the tempting alternative is wrong.\n` +
          `Set key_defensible false ONLY if after real effort the official answer still looks indefensible; then say why in "why". Do not force a bad justification.\n` +
          `Return via StructuredOutput.`,
        { label: `reconcile:Q${q.q_no}`, phase: 'Reconcile', schema: RECONCILE_SCHEMA, effort: 'high' },
      ).then((r) => (r ? { q_no: q.q_no, ...r } : null)),
    ),
  )
  const byNo = new Map(fixed.filter(Boolean).map((e) => [e.q_no, e]))
  for (const m of merged) {
    const e = byNo.get(m.q_no)
    if (!e) continue
    m.explanation_md = e.explanation_md
    m.key_supported = e.key_defensible !== false
    if (e.key_defensible === false) {
      m.disputed = true
      m.review_flag = `${m.review_flag} Reconciliation could not defend the key: ${e.why ?? ''}`.trim()
    }
  }
  log(`reconciled ${byNo.size} conflicting explanations; ${merged.filter((m) => m.disputed).length} left disputed`)
}

log(`CSAT ${YEAR}: key agreement ${agree}/${scored} · dropped ${dropped.size} · explanations ${merged.filter((m) => m.explanation_md).length}`)
return {
  paper: 'CSAT',
  year: YEAR,
  booklet_series: key?.booklet_series ?? null,
  agreement: { agree, scored },
  questions: merged,
}
