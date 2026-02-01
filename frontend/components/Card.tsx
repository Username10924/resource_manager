'use client';

import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return <div className={cn('px-8 py-6 border-b border-gray-50', className)}>{children}</div>;
}

export function CardTitle({ children, className }: CardProps) {
  return <h3 className={cn('text-lg font-semibold text-gray-900', className)}>{children}</h3>;
}

export function CardContent({ children, className }: CardProps) {
  return <div className={cn('px-8 py-6', className)}>{children}</div>;
}
