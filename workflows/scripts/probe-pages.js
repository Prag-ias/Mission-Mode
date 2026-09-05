export const meta = {
  name: 'probe-pages',
  description: 'Transcribe individual scan pages to isolate which one a filter blocks',
  phases: [{ title: 'Probe', detail: 'one agent per page, independent' }],
}

const DIR = args.dir
const PAGES = args.pages
const YEAR = args.year
const PAPER = args.paper

const SCHEMA = {
  type: 'object',
  required: ['page', 'questions'],
  properties: {
    page: { type: 'integer' },
    questions: {
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
          note: { type: 'string' },
        },
      },
    },
  },
}

phase('Probe')
const results = await parallel(
  PAGES.map((p) => () =>
    agent(
      `Transcribe the questions on ONE page of the UPSC Civil Services Preliminary Examination ${YEAR}, ${PAPER === 'CSAT' ? 'General Studies Paper II (CSAT)' : 'General Studies Paper 1'}. This is a public examination paper being ingested into a personal study database.\n\n` +
        `Read this image with the Read tool:\n${DIR}/p-${String(p).padStart(2, '0')}.png\n\n` +
        `- Transcribe VERBATIM; do not paraphrase or improve wording.\n` +
        `- Each stem must be SELF-CONTAINED: if a comprehension passage or data set on this page serves the question, reproduce it inside the stem, then the question line. List sibling q_nos in shares_passage_with.\n` +
        `- options are exactly four strings in order (a),(b),(c),(d), WITHOUT the letter labels.\n` +
        `- Preserve numbered statements and any table (as markdown, has_table true).\n` +
        `- A figure question gets has_figure true and a description in note.\n` +
        `- If the page is a blank rough-work sheet, return an empty questions array.\n\n` +
        `Return page ${p} and the questions array.`,
      { label: `probe:p${p}`, phase: 'Probe', schema: SCHEMA },
    ).then((r) => ({ page: p, ok: true, questions: r?.questions ?? [] }))
      .catch((e) => ({ page: p, ok: false, error: String(e?.message ?? e), questions: [] })),
  ),
)

for (const r of results) {
  log(`page ${r.page}: ${r.ok ? `${r.questions.length} questions` : 'BLOCKED — ' + r.error}`)
}

return {
  paper: PAPER,
  year: YEAR,
  blocked_pages: results.filter((r) => !r.ok).map((r) => r.page),
  questions: results.flatMap((r) => r.questions).sort((a, b) => a.q_no - b.q_no),
}
