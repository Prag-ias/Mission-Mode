export default function Loading() {
  return (
    <main className="mx-auto max-w-md px-4 pt-5 lg:max-w-5xl lg:px-8 lg:pt-10">
      <div className="h-7 w-48 animate-pulse rounded bg-line" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-line" />
      <div className="mt-6 flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-card border border-line bg-surface" />
        ))}
      </div>
    </main>
  )
}
