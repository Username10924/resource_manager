'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  FaChartLine,
  FaUsers,
  FaProjectDiagram,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaCog
} from 'react-icons/fa';
import { useState } from 'react';

interface NavigationProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Navigation({ isMobileOpen = false, onMobileClose }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleLinkClick = () => {
    // Close mobile drawer on navigation
    onMobileClose?.();
  };

  const getLinks = () => {
    if (!user) return [];

    const baseLinks = [
      { href: '/dashboard', label: 'Dashboard', icon: FaChartLine, section: 'ANALYTICS' }
    ];

    if (user.role === 'line_manager') {
      baseLinks.push({ href: '/resources', label: 'Resources', icon: FaUsers, section: 'ANALYTICS' });
    } else if (user.role === 'solution_architect') {
      baseLinks.push({ href: '/projects', label: 'Projects', icon: FaProjectDiagram, section: 'ANALYTICS' });
    }

    if (user.role === 'admin') {
      baseLinks.push(
        { href: '/resources', label: 'Resources', icon: FaUsers, section: 'ANALYTICS' },
        { href: '/projects', label: 'Projects', icon: FaProjectDiagram, section: 'ANALYTICS' }
      );
    }

    baseLinks.push({ href: '/dashboard/settings', label: 'Settings', icon: FaCog, section: 'CONFIGURATION' });

    return baseLinks;
  };

  const links = getLinks();

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-zinc-200">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={handleLinkClick}>
          <div className="w-8 h-8 rounded-md bg-zinc-900 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">R</span>
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-sm text-zinc-900">RMS</span>
          )}
        </Link>

        {/* Desktop collapse toggle (hidden on mobile) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:block p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          {isCollapsed ? <FaBars size={14} /> : <FaTimes size={14} />}
        </button>
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="md:hidden p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          <FaTimes size={14} />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-3">
        <div className="space-y-0.5 px-2">
          {!isCollapsed && (
            <div className="px-2 mb-2">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Analytics</p>
            </div>
          )}
          {links.filter(link => link.section === 'ANALYTICS').map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={handleLinkClick}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-zinc-100 text-zinc-900 font-medium'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                )}
                title={isCollapsed ? link.label : undefined}
              >
                <Icon className={cn(
                  "flex-shrink-0",
                  isActive ? "text-zinc-900" : "text-zinc-400"
                )} size={15} />
                {!isCollapsed && <span>{link.label}</span>}
              </Link>
            );
          })}

          {!isCollapsed && (
            <div className="px-2 mb-2 mt-5">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Configuration</p>
            </div>
          )}
          {isCollapsed && <div className="mt-4" />}
          {links.filter(link => link.section === 'CONFIGURATION').map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={handleLinkClick}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-zinc-100 text-zinc-900 font-medium'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                )}
                title={isCollapsed ? link.label : undefined}
              >
                <Icon className={cn(
                  "flex-shrink-0",
                  isActive ? "text-zinc-900" : "text-zinc-400"
                )} size={15} />
                {!isCollapsed && <span>{link.label}</span>}
              </Link>
            );
          })}
        </div>
      </div>

      {/* User Info and Logout */}
      {user && (
        <div className="border-t border-zinc-200 p-3 space-y-2">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 px-1 mb-2">
              <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div className="text-sm overflow-hidden min-w-0">
                <div className="font-medium text-zinc-900 truncate text-sm">{user.full_name}</div>
                <div className="text-xs text-zinc-500 capitalize truncate">
                  {user.role.replace('_', ' ')}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm transition-colors text-zinc-500 hover:text-red-600 hover:bg-red-50",
              isCollapsed && "justify-center"
            )}
            title={isCollapsed ? "Logout" : undefined}
          >
            <FaSignOutAlt className="flex-shrink-0" size={14} />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <nav className={cn(
        "fixed left-0 top-0 h-screen bg-white border-r border-zinc-200 transition-all duration-200 flex-col z-50 hidden md:flex",
        isCollapsed ? "w-16" : "w-56"
      )}>
        {sidebarContent}
      </nav>

      {/* Mobile drawer overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <nav className="fixed left-0 top-0 h-screen w-56 bg-white border-r border-zinc-200 z-50 flex flex-col">
            {sidebarContent}
          </nav>
        </div>
      )}
    </>
  );
}
