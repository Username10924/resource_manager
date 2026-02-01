'use client';

export default function Loading() {
  return (
    <div className="flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-cyan-50/30 py-12">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <p className="text-sm font-medium text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
