'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Navigation from './Navigation';
import { FaBars } from 'react-icons/fa';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <>
      <Navigation
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-zinc-200 z-40 flex items-center px-3 gap-3 md:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
        >
          <FaBars size={16} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-zinc-900 flex items-center justify-center">
            <span className="text-white text-xs font-bold">R</span>
          </div>
          <span className="font-semibold text-sm text-zinc-900">RMS</span>
        </div>
      </div>

      <div className="pl-0 md:pl-16 lg:pl-56 min-h-screen bg-[var(--background)]">
        <main className="p-4 sm:p-6 pt-[4.5rem] md:pt-6">
          {children}
        </main>
      </div>
    </>
  );
}
