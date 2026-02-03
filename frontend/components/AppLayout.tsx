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
      <div className="pl-64 min-h-screen bg-gray-50">
        <main className="p-8">
          {children}
        </main>
      </div>
    </>
  );
}
