'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { logBlock } from '@/app/actions'

type Block = {
  id: number
  slot: string
  start: string
  label: string
  sourceRef: string | null
  plannedMinutes: number
  actualMinutes: number | null
  status: string
  colour: string | null
  topicCode: string | null
  kind: string
  /** set when this is a carried/debt block from a past day — "29 Aug" */
  owedFrom?: string | null
}

/** Each block wears the hour it belongs to — the day runs dawn to night. */
function timeTint(start: string): string {
  const h = Number(start.slice(0, 2))
  if (h < 8) return 'tint-dawn'
  if (h < 17) return 'tint-day'
  if (h < 21) return 'tint-dusk'
  return 'tint-night'
}

function Label({ block, className }: { block: Block; className: string }) {
  // Revision blocks open the queue; topic blocks open their topic.
  const href = block.topicCode
    ? `/topic/${block.topicCode}`
    : block.kind === 'revision'
      ? '/revise'
      : block.kind === 'ca'
        ? '/ca'
        : block.kind === 'mock' || block.kind === 'analysis'
          ? '/tests/new'
          : null
  if (!href) return <h2 className={className}>{block.label}</h2>
  return (
    <h2 className={className}>
      <Link href={href} className="block">
        {block.label} <span className="text-muted">›</span>
      </Link>
    </h2>
  )
}

export default function BlockCard({ block }: { block: Block }) {
  const [fixing, setFixing] = useState(false)
  const done = block.status === 'done' && !fixing

  if (done) {
    return (
      <div
        data-testid={`block-${block.slot}`}
        className="rounded-card border border-line bg-bg p-4 opacity-60"
      >
        <Meta block={block} done />
        <Label
          block={block}
          className="mt-2 font-display text-lg font-bold leading-snug text-muted line-through"
        />
        <div className="mt-1 flex items-baseline justify-between">
          <p className="font-mono text-sm text-muted">
            Block {block.slot} — {block.actualMinutes} min
          </p>
          <button
            type="button"
            onClick={() => setFixing(true)}
            className="px-2 py-1 text-xs text-muted underline"
          >
            fix
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid={`block-${block.slot}`}
      className={`rounded-card border border-line bg-surface p-4 shadow-s card-lift ${timeTint(block.start)}`}
    >
      <Meta block={block} done={false} />
      <Label block={block} className="mt-2 font-display text-[22px] font-bold leading-tight" />
      {block.sourceRef && <p className="mt-1 text-sm text-muted">{block.sourceRef}</p>}
      <form
        action={async (formData) => {
          await logBlock(formData)
          setFixing(false)
        }}
        className="mt-4 flex gap-2"
      >
        <input type="hidden" name="id" value={block.id} />
        <input
          name="minutes"
          type="number"
          inputMode="numeric"
          min={1}
          max={720}
          required
          defaultValue={block.actualMinutes ?? block.plannedMinutes}
          aria-label="Actual minutes"
          className="h-14 w-24 rounded-btn border border-line bg-surface text-center font-mono text-lg font-bold outline-none focus:border-ink"
        />
        <DoneButton />
      </form>
    </div>
  )
}

function Meta({ block, done }: { block: Block; done: boolean }) {
  return (
    <div className="flex items-center gap-2 text-muted">
      <span
        aria-hidden
        className="inline-block size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: block.colour ?? '#a3a3a3' }}
      />
      <span className="font-mono text-sm font-bold text-ink">{block.start}</span>
      <span aria-hidden className="text-sm">
        ·
      </span>
      <span className="font-mono text-sm">{block.plannedMinutes} min</span>
      <span className={`mono-label ml-auto ${!done && block.owedFrom ? 'text-accent-deep' : ''}`}>
        {done ? 'done' : block.owedFrom ? `owed · ${block.owedFrom}` : `Block ${block.slot}`}
      </span>
    </div>
  )
}

function DoneButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-14 flex-1 rounded-btn bg-accent text-lg font-semibold text-white active:bg-accent-deep disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Done'}
    </button>
  )
}
