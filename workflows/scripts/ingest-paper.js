export const meta = {
  name: 'ingest-paper',
  description: 'Transcribe, verify, solve, key and tag one UPSC Prelims paper (GS1 or CSAT)',
  phases: [
    { title: 'Transcribe', detail: 'read the English scan pages verbatim' },
    { title: 'Verify', detail: 'independent re-read against the images' },
    { title: 'Solve', detail: 'solve blind, before the key is read' },
    { title: 'Key', detail: 'read the official answer key' },
    { title: 'Tag', detail: 'assign format, subject and topic codes' },
    { title: 'Reconcile', detail: 'rewrite explanations that argue against the key' },
  ],
}

const PAPER = args.paper // 'GS1' | 'CSAT'
const YEAR = args.year
const KEY_FILE = args.keyFile
const DO_VERIFY = args.verify !== false
const IS_CSAT = PAPER === 'CSAT'
const ROOT = 'C:/Users/KIIT/Mission 2027/Sarthi'
const DIR = `${ROOT}/.ingest/pages/${IS_CSAT ? 'csat' : 'gs1'}_${YEAR}`
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
      stem: { type: 'string' },
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
    pages_skipped: { type: 'array', items: { type: 'integer' } },
    questions: Q_ITEMS,
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['batch', 'verdict', 'questions'],
  properties: {
    batch: { type: 'string' },
    verdict: { type: 'string', enum: ['clean', 'corrected'] },
    q_numbers_found: { type: 'array', items: { type: 'integer' } },
    discrepancies: {
      type: 'array',
      items: {
        type: 'object',
        required: ['q_no', 'field', 'issue'],
        properties: {
          q_no: { type: 'integer' }, field: { type: 'string' }, issue: { type: 'string' },
          was: { type: 'string' }, now: { type: 'string' },
        },
      },
    },
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
          beyond_knowledge: { type: 'boolean' },
          explanation_md: { type: 'string' },
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

const FORMATS = ['simple', 'stmt_1_2', 'stmt_1_2_3', 'pairs', 'match_list', 'relationship', 'conclusion_count', 'assertion_basis', 'case_study', 'identify']

const TAG_SCHEMA = {
  type: 'object',
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['q_no', 'format', 'subject_code', 'topic_codes'],
        properties: {
          q_no: { type: 'integer' },
          format: { type: 'string', enum: FORMATS },
          subject_code: { type: 'string' },
          topic_codes: { type: 'array', items: { type: 'string' }, minItems: 1 },
          primary_topic_code: { type: 'string' },
          tagging_confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          tagging_note: { type: 'string' },
        },
      },
    },
  },
}

const paperName = IS_CSAT ? 'General Studies Paper II (CSAT)' : 'General Studies Paper 1'

phase('Transcribe')
const transcribed = await parallel(
  BATCHES.map((b) => () =>
    agent(
      `You are transcribing scanned pages of the UPSC Civil Services Preliminary Examination ${YEAR}, ${paperName}. This is a public examination paper being ingested into a personal study database.\n\n` +
        `Read these page images, in order, with the Read tool:\n${pathsFor(b)}\n\n` +
        `SOME PAGES MAY BE BLANK "SPACE FOR ROUGH WORK" SHEETS or the booklet cover. Skip those, list them in pages_skipped, and list pages that did contain questions in pages_with_questions.\n\n` +
        `ACCURACY RULES — this text becomes study material for an exam, so a transcription error teaches a wrong fact:\n` +
        `- Transcribe VERBATIM. Do not paraphrase, summarise, correct or "improve" any wording.\n` +
        `- Preserve the exact numbering a stem uses: Roman (I., II., III.) stays Roman; Arabic (1., 2., 3.) stays Arabic. They are different formats and the distinction matters.\n` +
        `- Include the full lead-in line ("Consider the following statements :", "Select the correct answer using the code given below.").\n` +
        `- The stem is everything except the four lettered choices. Statement lists, tables and lead-ins go INSIDE the stem, separated by newlines.\n` +
        `- options must be EXACTLY four strings in order (a),(b),(c),(d), WITHOUT the letter labels.\n` +
        `- Bold negatives like **not** must be preserved — missing a "not" inverts the answer. Italicised terms go in *asterisks*.\n` +
        `- A TABLE becomes a markdown table inside the stem, with has_table true.\n` +
        `- A map/diagram question gets has_figure true and a description in note.\n` +
        `- Record the PDF page number in "page" (from the filename, p-03.png -> 3).\n` +
        (IS_CSAT
          ? `- CRITICAL FOR CSAT: each stem must be SELF-CONTAINED. Comprehension passages and shared data sets serve several questions, and the app shows one question at a time — so reproduce the full passage inside the stem of EVERY question that needs it, then the question line. Also list the sibling q_nos in shares_passage_with.\n`
          : ``) +
        `\nDO NOT invent, skip, renumber or reorder questions. If a page is unreadable, say so in note rather than guessing.\n\n` +
        `Return batch "${b.id}" and the questions array.`,
      { label: `transcribe:${b.id}`, phase: 'Transcribe', schema: TRANSCRIBE_SCHEMA },
    ),
  ),
)

let byBatch = transcribed.map((r, i) => ({ batch: BATCHES[i], result: r }))

if (DO_VERIFY) {
  phase('Verify')
  const verified = await parallel(
    byBatch.map(({ batch: b, result: prev }) => () =>
      prev
        ? agent(
            `You are the independent verification pass for batch ${b.id} of the UPSC CSE ${YEAR} ${paperName} ingestion. Another agent transcribed these pages. CHECK its work against the source images and correct it — assume it made mistakes and hunt for them.\n\n` +
              `Read these page images yourself with the Read tool:\n${pathsFor(b)}\n\n` +
              `Here is the transcript to check:\n${JSON.stringify(prev.questions ?? [], null, 1)}\n\n` +
              `Check every question against what you actually see:\n` +
              `1. COMPLETENESS — is every question on these pages present? A missing question is the worst failure. List every question number visible in q_numbers_found.\n` +
              `2. OPTION INTEGRITY — exactly four, right order, none swapped or truncated.\n` +
              `3. NEGATIVES AND QUANTIFIERS — "not", "except", "only", "all", "never". A dropped negative inverts the answer.\n` +
              `4. NUMBERING STYLE — Roman vs Arabic exactly as printed.\n` +
              `5. NUMBERS, YEARS, NAMES — dates, article numbers, committee names, proper nouns.\n` +
              `6. TABLES — present, complete, aligned.\n` +
              `7. TRUNCATION — any stem or option ending mid-sentence.\n\n` +
              `Return the CORRECTED questions array in full (not just changes), the discrepancies you fixed, and verdict "clean" or "corrected".`,
            { label: `verify:${b.id}`, phase: 'Verify', schema: VERIFY_SCHEMA },
          )
        : null,
    ),
  )
  const fixes = verified.filter(Boolean).reduce((n, v) => n + (v.discrepancies?.length ?? 0), 0)
  log(`verify: ${verified.filter((v) => v?.verdict === 'corrected').length}/${verified.length} batches corrected, ${fixes} discrepancies fixed`)
  byBatch = byBatch.map((x, i) => (verified[i] ? { ...x, result: verified[i] } : x))
}

const questions = byBatch
  .map((x) => x.result)
  .filter(Boolean)
  .flatMap((r) => r.questions ?? [])
  .sort((a, b) => a.q_no - b.q_no)
log(`transcribed ${questions.length} questions`)

const CHUNK = 10
const chunks = []
for (let i = 0; i < questions.length; i += CHUNK) chunks.push(questions.slice(i, i + CHUNK))

phase('Solve')
const solvedChunks = await parallel(
  chunks.map((c, i) => () =>
    agent(
      `You are sitting UPSC Prelims ${YEAR}, ${paperName}. Answer each question below from your own knowledge and reasoning. You have NOT seen the answer key and must not guess at what it says — derive every answer yourself.\n\n` +
        (IS_CSAT
          ? `For numeracy, data interpretation and logical reasoning: do the actual arithmetic and logic step by step and state the result. These have one provably correct answer, so get it right rather than plausible.\nFor comprehension: decide only from the passage as given, quote the deciding line, and say why each other option fails.\n`
          : `Work statement by statement: for a "consider the following statements" question, give a verdict on EACH statement before choosing. That is how the paper is actually scored, and it is what makes the explanation useful.\nSet beyond_knowledge true if the fact is genuinely outside what you can verify (a very recent scheme, an obscure local detail) rather than pretending certainty.\n`) +
        `\nWrite explanation_md as the explanation a candidate will read at 21:40 while revising: specific, factual, short enough to absorb. Markdown; bold the deciding fact.\n\n` +
        JSON.stringify(c.map((q) => ({ q_no: q.q_no, stem: q.stem, options: q.options }))) +
        `\n\nReturn via StructuredOutput.`,
      { label: `solve:${i + 1}`, phase: 'Solve', schema: SOLVE_SCHEMA },
    ),
  ),
)
const solutions = solvedChunks.filter(Boolean).flatMap((r) => r.solutions ?? [])

phase('Key')
const key = await agent(
  `Read the official UPSC answer key for ${paperName} ${YEAR} at:\n${KEY_FILE}\n\n` +
    `Use the Read tool; it reads both images and PDFs. Transcribe EVERY question number and its answer letter exactly as printed. Do not solve anything yourself — just read what is there.\n` +
    `If the key is laid out in columns, follow each column carefully: column drift is the most common error here. Sanity-check that you have a complete run of question numbers with no duplicates and no gaps before returning.\n` +
    `Note the booklet series if printed, and list any question marked dropped or "full marks to all".\n` +
    `Answers must be lowercase a/b/c/d. If a key entry is ambiguous or handwritten with two letters, return it verbatim rather than picking one.\n` +
    `Return via StructuredOutput.`,
  { label: `key:${YEAR}`, phase: 'Key', schema: KEY_SCHEMA, effort: 'high' },
)

phase('Tag')
const taggedChunks = await parallel(
  chunks.map((c, i) => () =>
    agent(
      `You are classifying and tagging questions from UPSC CSE ${YEAR} ${paperName} for a personal study database.\n\n` +
        (IS_CSAT
          ? `subject_code is always "CSAT". topic_codes must come from exactly this list:\n` +
            `CSA-01 Comprehension — passage strategy and elimination under time\n` +
            `CSA-02 Logical reasoning and analytical ability\n` +
            `CSA-03 Basic numeracy — numbers, ratio, percentage, time-work, time-distance\n` +
            `CSA-04 Data interpretation — charts, tables, data sufficiency\n` +
            `CSA-05 Decision making and problem solving\n` +
            `Do NOT use CSA-06 (whole-paper practice, not a question tag). Usually one code; two only when genuinely both.\n`
          : `First read this file to learn the exact topic vocabulary you must use:\n` +
            `${ROOT}/seed/topics.json  (186 topics; each has "code", "subject" and "name")\n\n` +
            `subject_code is one of: POL HIS ANM ART ECO ENV GEO SNT CAI CSAT SOC — use the subject field in topics.json.\n` +
            `topic_codes: one to three codes that this question ACTUALLY tests. UPSC questions straddle topics; include the genuine ones, not everything plausible. primary_topic_code is the single best fit and must also appear in topic_codes.\n` +
            `Use ONLY codes that literally exist in topics.json. Never invent a code.\n` +
            `tagging_note: set it when confidence is medium or low, or when the question straddles subjects. **If NO topic in the vocabulary genuinely covers the question, say so explicitly** — that is a real finding about a gap in the syllabus tree, not a failure.\n`) +
        `\nformat — exactly one of: ${FORMATS.join(', ')}. Guidance:\n` +
        `- four plain choices, one correct -> simple\n- "Consider the following statements" with I. and II. only -> stmt_1_2\n` +
        `- three or more numbered statements -> stmt_1_2_3\n- "how many of the above pairs/statements are correct" -> pairs\n` +
        `- "Match List I with List II" -> match_list\n- asks how statements RELATE rather than whether they are true -> relationship\n` +
        `- "how many conclusions follow" -> conclusion_count\n- an assertion plus its supporting basis -> assertion_basis\n` +
        `- an administrative/ethical scenario -> case_study\n- identify a thing from clues -> identify\n\n` +
        JSON.stringify(c.map((q) => ({ q_no: q.q_no, stem: q.stem.slice(0, 1500), options: q.options }))) +
        `\n\nReturn via StructuredOutput.`,
      { label: `tag:${i + 1}`, phase: 'Tag', schema: TAG_SCHEMA },
    ),
  ),
)
const tags = taggedChunks.filter(Boolean).flatMap((r) => r.questions ?? [])

const solvedBy = new Map(solutions.map((s) => [s.q_no, s]))
const tagBy = new Map(tags.map((t) => [t.q_no, t]))
const keyBy = new Map((key?.answers ?? []).map((a) => [a.q_no, String(a.answer).toLowerCase().trim()]))
const dropped = new Set(key?.dropped ?? [])
const VALID = new Set(['a', 'b', 'c', 'd'])

let agree = 0
let scored = 0
const merged = questions.map((q) => {
  const s = solvedBy.get(q.q_no)
  const t = tagBy.get(q.q_no)
  const raw = keyBy.get(q.q_no) ?? null
  const official = raw && VALID.has(raw) ? raw : null
  const isDropped = dropped.has(q.q_no)
  if (official && s && !isDropped) {
    scored++
    if (official === s.answer) agree++
  }
  const codes = t?.topic_codes?.length ? t.topic_codes : null
  return {
    ...q,
    answer: isDropped ? null : official,
    answer_source: official ? 'official' : null,
    key_raw: raw && !VALID.has(raw) ? raw : null, // e.g. a handwritten "c or d"
    dropped_by_upsc: isDropped,
    independent_answer: s ? { answer: s.answer, confidence: s.confidence, beyond_knowledge: !!s.beyond_knowledge } : null,
    explanation_md: s?.explanation_md ?? null,
    format: t?.format ?? 'simple',
    subject_code: t?.subject_code ?? (IS_CSAT ? 'CSAT' : null),
    topic_codes: codes,
    primary_topic_code: t?.primary_topic_code ?? codes?.[0] ?? null,
    tagging_confidence: t?.tagging_confidence ?? null,
    tagging_note: t?.tagging_note ?? null,
    review_flag:
      official && s && official !== s.answer && !isDropped
        ? `Official key says ${official}, worked solution said ${s.answer} (${s.confidence} confidence).`
        : raw && !VALID.has(raw)
          ? `Answer key entry is not a single letter: "${raw}".`
          : null,
  }
})

phase('Reconcile')
const conflicts = merged.filter((m) => m.review_flag && m.answer)
if (conflicts.length) {
  // One agent, one question, and NO q_no in the schema: an agent given a single
  // item numbers it 1, which silently pastes one question's explanation onto
  // another when results are keyed on the returned number.
  const RECONCILE_SCHEMA = {
    type: 'object',
    required: ['explanation_md', 'key_defensible'],
    properties: {
      explanation_md: { type: 'string' },
      key_defensible: { type: 'boolean' },
      why: { type: 'string' },
    },
  }
  const fixed = await parallel(
    conflicts.map((q) => () =>
      agent(
        `A UPSC ${YEAR} ${paperName} question where an independent solver disagreed with the official answer key. The official key is what the app will show, so the explanation must justify the OFFICIAL answer.\n\n` +
          `Official answer: ${q.answer}\nSolver's answer: ${q.independent_answer?.answer}\n\n` +
          `Question:\n${q.stem}\n\nOptions:\n${q.options.map((o, i) => `${'abcd'[i]}) ${o}`).join('\n')}\n\n` +
          `First work out honestly why UPSC's answer is the intended one — usually a precise word the candidate skimmed (a quantifier like "all" or "only", a compound term split apart, a term of art swapped for a near-synonym), or a fact the solver had wrong. Then write explanation_md defending the official answer, naming that exact distinction, and saying plainly why the tempting alternative fails.\n` +
          `Set key_defensible false ONLY if after real effort the official answer is still indefensible — for a question with a computable answer, say arithmetic, that means the key contradicts the numbers. Then explain in "why". Do not force a bad justification.\n` +
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

const gaps = merged.filter((m) => m.tagging_note).map((m) => ({ q_no: m.q_no, note: m.tagging_note }))
log(`${PAPER} ${YEAR}: key agreement ${agree}/${scored} · dropped ${dropped.size} · explanations ${merged.filter((m) => m.explanation_md).length} · tagging notes ${gaps.length}`)

return {
  paper: PAPER,
  year: YEAR,
  booklet_series: key?.booklet_series ?? null,
  agreement: { agree, scored },
  tagging_notes: gaps,
  questions: merged,
}
