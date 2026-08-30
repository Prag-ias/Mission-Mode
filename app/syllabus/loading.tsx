export default function Loading() {
  return (
    <main className="mx-auto max-w-md px-4 pt-5 lg:max-w-4xl lg:px-8 lg:pt-10">
      <div className="h-7 w-40 animate-pulse rounded bg-line" />
      <div className="mt-5 flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-card border border-line bg-surface" />
        ))}
      </div>
    </main>
  )
}
