import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'indigo';
}

export default function StatsCard({
  title,
  value,
  description,
  icon,
  color = 'blue'
}: StatsCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-zinc-500">{title}</p>
        <p className="text-2xl font-semibold text-zinc-900 tracking-tight">{value}</p>
        {description && (
          <p className="text-xs text-zinc-500 mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}
