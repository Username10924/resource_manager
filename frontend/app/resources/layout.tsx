'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ResourcesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else if (user?.role === 'solution_architect') {
      // Redirect solution architects to projects page
      router.push('/projects');
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || user?.role === 'solution_architect') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900"></div>
      </div>
    );
  }

  return <>{children}</>;
}
