export default function Loading() {
  return (
    <main className="mx-auto max-w-md px-4 pt-5 lg:max-w-3xl lg:pt-8">
      <div className="h-7 w-48 animate-pulse rounded bg-line" />
      <div className="mt-5 flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-btn border border-line bg-surface" />
        ))}
      </div>
    </main>
  )
}
