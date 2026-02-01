'use client';

import { useAuth } from '@/contexts/AuthContext';
import Navigation from './Navigation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {isAuthenticated && <Navigation />}
      {children}
    </>
  );
}
