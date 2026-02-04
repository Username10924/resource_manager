'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import Button from './Button';
import { 
  FaChartLine, 
  FaUsers, 
  FaProjectDiagram,
  FaSignOutAlt,
  FaBars,
  FaTimes
} from 'react-icons/fa';
import { useState } from 'react';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  // Define links based on user role
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

    // Admins can see everything
    if (user.role === 'admin') {
      baseLinks.push(
        { href: '/resources', label: 'Resources', icon: FaUsers, section: 'ANALYTICS' },
        { href: '/projects', label: 'Projects', icon: FaProjectDiagram, section: 'ANALYTICS' }
      );
    }

    return baseLinks;
  };

  const links = getLinks();

  return (
    <nav className={cn(
      "fixed left-0 top-0 h-screen bg-white border-r border-gray-200 transition-all duration-300 flex flex-col z-50",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className="flex flex-col h-full">
        {/* Header with Logo and Toggle */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-10 h-10 flex items-center justify-center transition-transform group-hover:scale-105">
                <svg width="40" height="40" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="block">
                  <defs>
                    <linearGradient id="aiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00d2ff" stopOpacity="1" />
                      <stop offset="100%" stopColor="#10a37f" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                  <g fill="none" stroke="url(#aiGradient)" strokeWidth="26" strokeLinecap="round">
                    <path d="M 100 40 A 60 60 0 0 1 152 70" />
                    <path d="M 152 70 A 60 60 0 0 1 152 130" />
                    <path d="M 152 130 A 60 60 0 0 1 100 160" />
                    <path d="M 100 160 A 60 60 0 0 1 48 130" />
                    <path d="M 48 130 A 60 60 0 0 1 48 70" />
                    <path d="M 48 70 A 60 60 0 0 1 100 40" />
                  </g>
                  <circle cx="100" cy="100" r="15" fill="#ffffff" fillOpacity="0.1" />
                </svg>
              </div>
              {!isCollapsed && (
                <span className="font-bold text-lg bg-gradient-to-r from-[#4F46E5] to-[#6366F1] bg-clip-text text-transparent">
                  RMS
                </span>
              )}
            </Link>
            
            {/* Toggle Button */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {isCollapsed ? <FaBars className="text-gray-600" /> : <FaTimes className="text-gray-600" />}
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto py-4">
            {!isCollapsed && (
              <div className="px-5 mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ANALYTICS</p>
              </div>
            )}
            <div className="space-y-1 px-3">
              {links.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all group',
                      isActive
                        ? 'text-[#4F46E5]'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )}
                    title={isCollapsed ? link.label : undefined}
                  >
                    <Icon className={cn(
                      "flex-shrink-0 text-lg",
                      isActive ? "text-[#4F46E5]" : "text-gray-500 group-hover:text-gray-700"
                    )} />
                    {!isCollapsed && <span>{link.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Info and Logout */}
          {user && (
            <div className="border-t border-gray-200 p-4 space-y-2">
              {!isCollapsed && (
                <div className="flex items-center gap-3 px-2 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#6366F1] flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="text-sm overflow-hidden">
                    <div className="font-medium text-gray-900 truncate">{user.full_name}</div>
                    <div className="text-xs text-gray-500 capitalize truncate">
                      {user.role.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-all text-gray-600 hover:text-red-600 hover:bg-red-50",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? "Logout" : undefined}
              >
                <FaSignOutAlt className="flex-shrink-0 text-lg" />
                {!isCollapsed && <span>Logout</span>}
              </button>
            </div>
          )}
      </div>
    </nav>
  );
}
