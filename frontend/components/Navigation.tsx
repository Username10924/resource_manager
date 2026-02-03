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
              <div className="w-10 h-10 transition-transform group-hover:scale-105">
                <svg width="40" height="40" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="gradTop" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="#FF6B2B"/>
                      <stop offset="100%" stopColor="#FF8A3D"/>
                    </linearGradient>
                    <linearGradient id="gradBottom" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF6B2B"/>
                      <stop offset="100%" stopColor="#FFB06A"/>
                    </linearGradient>
                    <linearGradient id="gradRight" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#FF2D55"/>
                      <stop offset="100%" stopColor="#FF4F6D"/>
                    </linearGradient>
                    <linearGradient id="gradLeft" x1="1" y1="0" x2="0" y2="0">
                      <stop offset="0%" stopColor="#FF2D55"/>
                      <stop offset="100%" stopColor="#FF6B8A"/>
                    </linearGradient>
                    <radialGradient id="cyanOrb" cx="50%" cy="40%" r="50%">
                      <stop offset="0%" stopColor="#AEFEFF"/>
                      <stop offset="60%" stopColor="#4DDFFF"/>
                      <stop offset="100%" stopColor="#1AACCC"/>
                    </radialGradient>
                    <radialGradient id="purpleOrb" cx="50%" cy="40%" r="50%">
                      <stop offset="0%" stopColor="#B49DFF"/>
                      <stop offset="60%" stopColor="#7B6CFF"/>
                      <stop offset="100%" stopColor="#5A4BD1"/>
                    </radialGradient>
                    <filter id="glowCyan" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
                      <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                    <filter id="glowPurple" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
                      <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                    <filter id="armShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#FF4F6D" floodOpacity="0.25"/>
                    </filter>
                    <filter id="armShadowOrange" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#FF8A3D" floodOpacity="0.25"/>
                    </filter>
                    <clipPath id="clipTop">
                      <rect x="160" y="40" width="80" height="130" rx="40"/>
                    </clipPath>
                  </defs>
                  <g transform="rotate(-3, 200, 200)">
                    <rect x="168" y="52" width="64" height="120" rx="32" fill="url(#gradTop)" filter="url(#armShadowOrange)"/>
                    <rect x="182" y="60" width="12" height="96" rx="6" fill="white" opacity="0.12"/>
                  </g>
                  <g transform="rotate(3, 200, 200)">
                    <rect x="168" y="228" width="64" height="120" rx="32" fill="url(#gradBottom)" filter="url(#armShadowOrange)"/>
                    <rect x="182" y="236" width="12" height="96" rx="6" fill="white" opacity="0.12"/>
                  </g>
                  <g transform="rotate(3, 200, 200)">
                    <rect x="228" y="168" width="120" height="64" rx="32" fill="url(#gradRight)" filter="url(#armShadow)"/>
                    <rect x="236" y="182" width="96" height="12" rx="6" fill="white" opacity="0.12"/>
                  </g>
                  <g transform="rotate(-3, 200, 200)">
                    <rect x="52" y="168" width="120" height="64" rx="32" fill="url(#gradLeft)" filter="url(#armShadow)"/>
                    <rect x="60" y="182" width="96" height="12" rx="6" fill="white" opacity="0.12"/>
                  </g>
                  <circle cx="200" cy="200" r="52" fill="#1E1633" opacity="0.15"/>
                  <circle cx="200" cy="200" r="42" fill="none" stroke="#FF6B8A" strokeWidth="3" opacity="0.35"/>
                  <circle cx="200" cy="200" r="30" fill="#1E1633" opacity="0.2"/>
                  <g filter="url(#glowCyan)">
                    <circle cx="200" cy="42" r="18" fill="url(#cyanOrb)"/>
                  </g>
                  <circle cx="195" cy="37" r="5" fill="white" opacity="0.45"/>
                  <g filter="url(#glowCyan)">
                    <circle cx="200" cy="358" r="18" fill="url(#cyanOrb)"/>
                  </g>
                  <circle cx="195" cy="353" r="5" fill="white" opacity="0.45"/>
                  <g filter="url(#glowPurple)">
                    <circle cx="358" cy="200" r="18" fill="url(#purpleOrb)"/>
                  </g>
                  <circle cx="353" cy="195" r="5" fill="white" opacity="0.45"/>
                  <g filter="url(#glowPurple)">
                    <circle cx="42" cy="200" r="18" fill="url(#purpleOrb)"/>
                  </g>
                  <circle cx="37" cy="195" r="5" fill="white" opacity="0.45"/>
                  <circle cx="270" cy="105" r="3.5" fill="#7B6CFF" opacity="0.55"/>
                  <circle cx="288" cy="88" r="2" fill="#4DDFFF" opacity="0.45"/>
                  <circle cx="255" cy="78" r="2.5" fill="#FF4F6D" opacity="0.4"/>
                  <circle cx="130" cy="295" r="3.5" fill="#4DDFFF" opacity="0.55"/>
                  <circle cx="112" cy="312" r="2" fill="#7B6CFF" opacity="0.45"/>
                  <circle cx="145" cy="322" r="2.5" fill="#FF8A3D" opacity="0.4"/>
                  <circle cx="118" cy="108" r="2.5" fill="#FF8A3D" opacity="0.4"/>
                  <circle cx="100" cy="90" r="2" fill="#4DDFFF" opacity="0.35"/>
                  <circle cx="282" cy="292" r="2.5" fill="#FF4F6D" opacity="0.4"/>
                  <circle cx="300" cy="310" r="2" fill="#7B6CFF" opacity="0.35"/>
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
