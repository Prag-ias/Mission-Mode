export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-5 sm:px-6">
      <div className="h-4 w-24 animate-pulse rounded bg-line" />
      <div className="mt-4 h-1 w-full rounded-full bg-line" />
      <div className="mt-4 h-96 animate-pulse rounded-card border border-line bg-surface" />
    </main>
  )
}
