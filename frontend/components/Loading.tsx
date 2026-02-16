'use client';

export default function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900"></div>
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    </div>
  );
}
