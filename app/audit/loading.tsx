export default function Loading() {
  return (
    <main className="mx-auto max-w-md px-4 pt-5 lg:max-w-6xl lg:px-8 lg:pt-8">
      <div className="h-7 w-40 animate-pulse rounded bg-line" />
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-card border border-line bg-surface" />
        ))}
      </div>
    </main>
  )
}
