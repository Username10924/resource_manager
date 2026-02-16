'use client';

import { useAuth } from '@/contexts/AuthContext';
import Navigation from './Navigation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <>
      <Navigation />
      <div className="pl-56 min-h-screen bg-[var(--background)]">
        <main className="p-6">
          {children}
        </main>
      </div>
    </>
  );
}
