'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { recordAttempt } from '@/app/practice/actions'
import { CONFIDENCE, nextSeed, type Confidence } from '@/lib/practice'

type Q = {
  id: number
  year: number
  qNo: number
  stem: string
  options: string[]
  answer: string
  explanation: string
  format: string
  disputed: boolean
  subjectName: string | null
  subjectColour: string | null
  topicCode: string | null
  topicName: string | null
}

const REASONS = [
  { code: 1, label: 'Didn’t know' },
  { code: 2, label: 'Knew but forgot' },
  { code: 3, label: 'Misread the question' },
  { code: 4, label: 'Confused two things' },
  { code: 5, label: 'Bad guess' },
  { code: 6, label: 'Ran out of time' },
]

const LETTERS = ['a', 'b', 'c', 'd'] as const

/** Minimal markdown for stems and explanations: bold, italic, lists, tables. */
function md(src: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (t: string) =>
    esc(t)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  return src
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n')
      if (lines.length > 1 && lines.every((l) => l.trim().startsWith('|'))) {
        const cells = lines
          .filter((l) => !/^\s*\|[\s|:-]+\|\s*$/.test(l))
          .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
        const [head, ...body] = cells
        return `<div class="tablewrap"><table><thead><tr>${head
          .map((c) => `<th>${inline(c)}</th>`)
          .join('')}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`
      }
      if (lines.every((l) => l.trim().startsWith('- '))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.trim().slice(2))}</li>`).join('')}</ul>`
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`
    })
    .join('')
}

export default function PracticeRunner({
  batch,
  backHref,
  seed,
}: {
  batch: Q[]
  backHref: string
  seed: string
}) {
  const [i, setI] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [confidence, setConfidence] = useState<Confidence | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [reason, setReason] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [log, setLog] = useState<{ correct: boolean; confidence: Confidence; disputed: boolean }[]>([])
  const startedAt = useRef(Date.now())

  const q = batch[i]
  const done = i >= batch.length
  const isCorrect = revealed && !!q && chosen === q.answer

  useEffect(() => {
    startedAt.current = Date.now()
  }, [i])

  async function save() {
    if (!q || !chosen || !confidence || saving) return
    setSaving(true)
    const correct = chosen === q.answer
    await recordAttempt({
      questionId: q.id,
      chosen,
      confidence,
      reasonCode: correct ? null : reason,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
    })
    setLog((l) => [...l, { correct, confidence, disputed: q.disputed }])
    setChosen(null)
    setConfidence(null)
    setRevealed(false)
    setReason(null)
    setSaving(false)
    setI((n) => n + 1)
  }

  // Desktop keyboard shortcuts. Harmless on a phone, a real speed-up on a laptop.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || saving) return
      const k = e.key.toLowerCase()
      if (!revealed) {
        if ((LETTERS as readonly string[]).includes(k)) setChosen(k)
        else if (k === '1') setConfidence('sure')
        else if (k === '2') setConfidence('unsure')
        else if (k === '3') setConfidence('guess')
        else if (e.key === 'Enter' && chosen && confidence) setRevealed(true)
      } else {
        if (!isCorrect && /^[1-6]$/.test(k)) setReason(Number(k))
        else if (e.key === 'Enter' && (isCorrect || reason)) void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (done) {
    const scored = log.filter((l) => !l.disputed)
    const right = scored.filter((l) => l.correct).length
    const guessedRight = scored.filter((l) => l.correct && l.confidence !== 'sure').length
    const sureWrong = scored.filter((l) => !l.correct && l.confidence === 'sure').length
    const excluded = log.length - scored.length
    return (
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6">
        <div data-testid="summary" className="rounded-card border border-line bg-surface p-6 shadow-s sm:p-8">
          <p className="mono-label text-muted">batch complete</p>
          <p className="mt-2 font-display text-5xl font-extrabold tabular-nums lg:text-6xl">
            {right}
            <span className="text-muted">/{scored.length}</span>
          </p>
          <p className="mt-1 text-muted">{log.length} questions attempted</p>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-btn border border-line bg-bg p-4">
              <dt className="mono-label text-muted">correct but not sure</dt>
              <dd className="font-mono text-2xl font-bold tabular-nums">{guessedRight}</dd>
              <p className="mt-1 text-xs text-muted">The ones you do not actually know yet.</p>
            </div>
            <div className="rounded-btn border border-line bg-bg p-4">
              <dt className="mono-label text-muted">sure but wrong</dt>
              <dd className="font-mono text-2xl font-bold tabular-nums text-accent-deep">{sureWrong}</dd>
              <p className="mt-1 text-xs text-muted">Confident and wrong is the most expensive gap.</p>
            </div>
          </dl>

          {excluded > 0 && (
            <p className="mt-4 text-sm text-muted">
              {excluded} disputed question{excluded === 1 ? '' : 's'} excluded from the score.
            </p>
          )}

          <div className="mt-7 flex flex-col gap-2 sm:flex-row">
            <Link
              href={`${backHref.replace(/([?&])seed=[^&]*/, '$1seed=' + nextSeed(seed))}`}
              className="flex h-14 flex-1 items-center justify-center rounded-btn bg-accent text-lg font-semibold text-white active:bg-accent-deep lg:hover:bg-accent-deep"
            >
              Another batch
            </Link>
            <Link
              href="/"
              className="flex h-14 flex-1 items-center justify-center rounded-btn border border-line bg-surface font-medium active:bg-bg"
            >
              Today
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-5 sm:px-6">
      <header className="mb-3 flex items-center gap-3">
        <Link href={backHref} className="mono-label text-muted underline">
          exit
        </Link>
        <span data-testid="progress" className="mono-label ml-auto text-muted">
          {i + 1} of {batch.length}
        </span>
      </header>

      <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full bg-accent transition-all" style={{ width: `${(i / batch.length) * 100}%` }} />
      </div>

      <article className="rounded-card border border-line bg-surface p-5 shadow-s sm:p-7">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {q.subjectName && (
            <span className="mono-label flex items-center gap-1.5 text-muted">
              <span
                aria-hidden
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: q.subjectColour ?? '#a3a3a3' }}
              />
              {q.subjectName}
            </span>
          )}
          <span className="mono-label text-muted">
            {q.year} · Q{q.qNo}
          </span>
          {q.disputed && (
            <span
              data-testid="disputed-badge"
              className="mono-label rounded-full border border-accent px-2 py-1 text-accent-deep"
            >
              disputed · not scored
            </span>
          )}
        </div>

        <div className="prose-q" dangerouslySetInnerHTML={{ __html: md(q.stem) }} />

        <ul className="mt-5 flex flex-col gap-2">
          {q.options.map((o, idx) => {
            const L = LETTERS[idx]
            const picked = chosen === L
            const isAnswer = revealed && q.answer === L
            const isWrongPick = revealed && picked && !isAnswer
            return (
              <li key={L}>
                <button
                  type="button"
                  data-testid={`option-${L}`}
                  disabled={revealed || saving}
                  onClick={() => setChosen(L)}
                  className={`flex w-full items-start gap-3 rounded-btn border p-3.5 text-left transition sm:p-4 ${
                    isAnswer
                      ? 'border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950'
                      : isWrongPick
                        ? 'border-accent bg-bg'
                        : picked
                          ? 'border-ink bg-bg'
                          : 'border-line bg-surface lg:hover:border-muted'
                  }`}
                >
                  <span className="font-mono text-sm font-bold">{L}</span>
                  <span
                    className="flex-1"
                    dangerouslySetInnerHTML={{ __html: md(o).replace(/^<p>|<\/p>$/g, '') }}
                  />
                  {isAnswer && <span className="mono-label shrink-0 text-emerald-700 dark:text-emerald-400">correct</span>}
                </button>
              </li>
            )
          })}
        </ul>

        {!revealed ? (
          <>
            <p className="mono-label mb-2 mt-6 text-muted">how sure are you?</p>
            <div className="flex gap-2">
              {CONFIDENCE.map((c, n) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setConfidence(c)}
                  className={`h-12 flex-1 rounded-btn border text-sm font-medium transition ${
                    confidence === c ? 'border-ink bg-ink text-bg' : 'border-line bg-surface lg:hover:border-muted'
                  }`}
                >
                  {c}
                  <span className="ml-1.5 hidden font-mono text-[10px] opacity-50 lg:inline">{n + 1}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              data-testid="reveal"
              disabled={!chosen || !confidence}
              onClick={() => setRevealed(true)}
              className="mt-4 h-14 w-full rounded-btn bg-accent text-lg font-semibold text-white transition active:bg-accent-deep disabled:opacity-40 lg:hover:bg-accent-deep"
            >
              {!chosen ? 'Choose an option' : !confidence ? 'Pick a confidence first' : 'Check'}
            </button>
          </>
        ) : (
          <div className="mt-6">
            <p
              data-testid="verdict"
              data-correct={String(isCorrect)}
              className={`font-display text-xl font-bold ${isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-accent-deep'}`}
            >
              {isCorrect ? 'Correct' : `Wrong — the answer is ${q.answer}`}
            </p>

            <div
              data-testid="explanation"
              className="prose-q mt-3 border-t border-line pt-3"
              dangerouslySetInnerHTML={{ __html: md(q.explanation) }}
            />

            {q.topicCode && (
              <Link href={`/topic/${q.topicCode}`} className="mono-label mt-3 inline-block text-accent-deep underline">
                {q.topicName ?? q.topicCode}
              </Link>
            )}

            {!isCorrect && (
              <>
                <p className="mono-label mb-2 mt-6 text-muted">why did you miss it? (required)</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {REASONS.map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      data-testid={`reason-${r.code}`}
                      onClick={() => setReason(r.code)}
                      className={`rounded-btn border p-3 text-left text-sm transition ${
                        reason === r.code ? 'border-ink bg-ink text-bg' : 'border-line bg-surface lg:hover:border-muted'
                      }`}
                    >
                      <span className="font-mono text-xs opacity-60">{r.code}</span> {r.label}
                    </button>
                  ))}
                </div>
                {reason === 2 && (
                  <p className="mt-2 text-xs text-muted">This pulls that topic&rsquo;s next revision closer.</p>
                )}
              </>
            )}

            <button
              type="button"
              data-testid="next"
              disabled={(!isCorrect && !reason) || saving}
              onClick={() => void save()}
              className="mt-5 h-14 w-full rounded-btn bg-accent text-lg font-semibold text-white transition active:bg-accent-deep disabled:opacity-40 lg:hover:bg-accent-deep"
            >
              {saving
                ? 'Saving…'
                : !isCorrect && !reason
                  ? 'Pick a reason to continue'
                  : i + 1 === batch.length
                    ? 'Finish'
                    : 'Next'}
            </button>
          </div>
        )}
      </article>
    </main>
  )
}
