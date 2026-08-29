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
}

function Label({ block, className }: { block: Block; className: string }) {
  if (!block.topicCode) return <h2 className={className}>{block.label}</h2>
  return (
    <h2 className={className}>
      <Link href={`/topic/${block.topicCode}`} className="block">
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
      className="rounded-card border border-line bg-surface p-4 shadow-s"
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
      <span className="mono-label ml-auto">{done ? 'done' : `Block ${block.slot}`}</span>
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
