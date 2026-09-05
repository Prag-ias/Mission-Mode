export const meta = {
  name: 'stitch-passage',
  description: 'Rebuild self-contained stems for questions whose passage spans two scan pages',
  phases: [{ title: 'Stitch', detail: 'read both pages, assemble the whole passage' }],
}

const DIR = args.dir
const PAGES = args.pages
const Q_NOS = args.qNos
const YEAR = args.year

const SCHEMA = {
  type: 'object',
  required: ['passage', 'questions'],
  properties: {
    passage: { type: 'string', description: 'the complete passage, start to finish' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['q_no', 'question_text', 'options'],
        properties: {
          q_no: { type: 'integer' },
          question_text: { type: 'string', description: 'ONLY the question line for this item; do NOT repeat the passage' },
          options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
        },
      },
    },
  },
}

phase('Stitch')
const r = await agent(
  `A comprehension passage in the UPSC CSAT ${YEAR} paper spans two scan pages, so the questions were transcribed with only the tail of the passage. Rebuild them properly.\n\n` +
    `Read BOTH images with the Read tool, in this order:\n${PAGES.map((p) => `${DIR}/p-${String(p).padStart(2, '0')}.png`).join('\n')}\n\n` +
    `The passage starts in a column of the first page (it opens with words like "It is no longer enough for us to talk about providing for universal access to education...") and finishes on the second page (ending "...bypass childhood."). These are the English pages of a bilingual booklet, so ignore any Devanagari.\n\n` +
    `Return:\n` +
    `1. passage — the COMPLETE passage, verbatim, start to finish, with the two halves joined seamlessly. Do not paraphrase, summarise or add anything.\n` +
    `2. questions — for each of items ${Q_NOS.join(', ')}: ONLY that item's own question line, exactly as printed, in question_text. **Do NOT repeat the passage inside question_text** — the passage is returned once above and gets prepended mechanically. options are the four printed choices in order, without their (a)-(d) labels.\n\n` +
    `Accuracy matters more than speed: this becomes study material, so a dropped negative or a changed quantifier teaches a wrong answer.`,
  { label: `stitch:${Q_NOS.join('-')}`, phase: 'Stitch', schema: SCHEMA },
)

// The passage is returned once and prepended here. Asking the model to repeat
// it inside four stems tripped an output content filter on volume alone.
const stems = (r?.questions ?? []).map((q) => ({
  q_no: q.q_no,
  stem: [r.passage, q.question_text].join('\n\n'),
  options: q.options,
}))
log(`passage rebuilt: ${r?.passage?.length ?? 0} chars; ${stems.length} stems assembled locally`)
return { passage: r?.passage ?? null, questions: stems }
