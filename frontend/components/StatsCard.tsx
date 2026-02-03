import { ReactNode } from 'react';
import { Card, CardContent } from './Card';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'indigo';
}

const colorClasses = {
  blue: 'bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600',
  green: 'bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600',
  purple: 'bg-gradient-to-br from-purple-50 to-indigo-50 text-purple-600',
  orange: 'bg-gradient-to-br from-orange-50 to-pink-50 text-orange-600',
  red: 'bg-gradient-to-br from-red-50 to-pink-50 text-red-600',
  indigo: 'bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600',
};

export default function StatsCard({ 
  title, 
  value, 
  description, 
  icon, 
  trend,
  color = 'blue' 
}: StatsCardProps) {
  return (
    <Card className="overflow-hidden bg-white">
      <CardContent className="pt-5 pb-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
            {trend && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                ↑ {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
