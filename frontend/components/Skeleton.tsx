import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseStyles = 'bg-gray-200';
  
  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const animationStyles = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${animationStyles[animation]} ${className}`}
      style={style}
    />
  );
}

// Composite skeleton components for common UI patterns

export function SkeletonCard({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}>
      {children || (
        <div className="space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      )}
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full">
      {/* Table Header */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      {/* Table Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="border-b border-gray-200 px-6 py-4">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} className="h-4 flex-1" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatsCard() {
  return (
    <SkeletonCard>
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-3 w-40" />
      </div>
    </SkeletonCard>
  );
}

export function SkeletonChart() {
  return (
    <SkeletonCard>
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    </SkeletonCard>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-cyan-50/30">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Skeleton className="mb-2 h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatsCard key={i} />
          ))}
        </div>

        {/* Main Content */}
        <SkeletonCard className="p-0">
          <SkeletonTable rows={8} columns={5} />
        </SkeletonCard>
      </div>
    </div>
  );
}

export function SkeletonProjectsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Skeleton className="mb-2 h-10 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatsCard key={i} />
          ))}
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i}>
              <div className="space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonResourcesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-cyan-50/30">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Skeleton className="mb-2 h-10 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatsCard key={i} />
          ))}
        </div>

        {/* Table */}
        <SkeletonCard className="p-0">
          <div className="p-6">
            <Skeleton className="mb-4 h-6 w-32" />
          </div>
          <SkeletonTable rows={10} columns={5} />
        </SkeletonCard>
      </div>
    </div>
  );
}

export function SkeletonDashboardCharts() {
  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonStatsCard key={i} />
        ))}
      </div>

      {/* Main Chart */}
      <SkeletonChart />

      {/* Two Column Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonChart />
        <SkeletonChart />
      </div>

      {/* Department Table */}
      <SkeletonCard className="p-0">
        <div className="p-6">
          <Skeleton className="mb-4 h-6 w-48" />
        </div>
        <SkeletonTable rows={5} columns={4} />
      </SkeletonCard>
    </div>
  );
}

export function SkeletonModal() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="rounded-lg bg-gray-50 p-4">
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

export function SkeletonScheduleHistory() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}


