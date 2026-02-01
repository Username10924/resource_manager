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
    <Card className="overflow-hidden hover:shadow-lg transition-all">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
            <p className="mt-3 text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">{value}</p>
            {description && (
              <p className="mt-2 text-sm text-gray-600">{description}</p>
            )}
            {trend && (
              <div className="mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium" 
                style={{
                  backgroundColor: trend.isPositive ? 'rgb(220 252 231)' : 'rgb(254 226 226)',
                  color: trend.isPositive ? 'rgb(22 163 74)' : 'rgb(220 38 38)'
                }}>
                <span>{trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              </div>
            )}
          </div>
          {icon && (
            <div className={`rounded-2xl p-4 ${colorClasses[color]} shadow-sm`}>
              <div className="text-2xl">{icon}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
