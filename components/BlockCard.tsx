'use client'

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
}

export default function BlockCard({ block }: { block: Block }) {
  const [fixing, setFixing] = useState(false)
  const done = block.status === 'done' && !fixing

  if (done) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 opacity-60">
        <Meta block={block} done />
        <h2 className="mt-1.5 text-xl font-semibold leading-snug text-neutral-500 line-through">
          {block.label}
        </h2>
        <div className="mt-1 flex items-baseline justify-between">
          <p className="text-sm text-neutral-500">
            Block {block.slot} — {block.actualMinutes} min
          </p>
          <button
            type="button"
            onClick={() => setFixing(true)}
            className="px-2 py-1 text-sm text-neutral-400 underline"
          >
            fix
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <Meta block={block} done={false} />
      <h2 className="mt-1.5 text-2xl font-semibold leading-snug">{block.label}</h2>
      {block.sourceRef && <p className="mt-1 text-sm text-neutral-500">{block.sourceRef}</p>}
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
          className="h-14 w-24 rounded-xl border border-neutral-300 text-center text-lg font-medium tabular-nums outline-none focus:border-neutral-900"
        />
        <DoneButton />
      </form>
    </div>
  )
}

function Meta({ block, done }: { block: Block; done: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-500">
      <span
        aria-hidden
        className="inline-block size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: block.colour ?? '#a3a3a3' }}
      />
      <span className="font-medium tabular-nums">{block.start}</span>
      <span aria-hidden>·</span>
      <span className="tabular-nums">{block.plannedMinutes} min</span>
      <span className="ml-auto">{done ? 'done' : `Block ${block.slot}`}</span>
    </div>
  )
}

function DoneButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-14 flex-1 rounded-xl bg-neutral-900 text-lg font-medium text-white active:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Done'}
    </button>
  )
}
