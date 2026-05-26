import { Skeleton } from "@navaxa/ui";

export default function Loading() {
  return (
    <div className="container max-w-6xl py-8">
      <Skeleton className="h-9 w-52" />
      <Skeleton className="mt-2 h-4 w-72" />

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}
