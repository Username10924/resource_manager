'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import Button from './Button';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  // Define links based on user role
  const getLinks = () => {
    if (!user) return [];

    const baseLinks = [
      { href: '/dashboard', label: 'Dashboard' }
    ];

    if (user.role === 'line_manager') {
      baseLinks.push({ href: '/resources', label: 'Resources' });
    } else if (user.role === 'solution_architect') {
      baseLinks.push({ href: '/projects', label: 'Projects' });
    }

    // Admins can see everything
    if (user.role === 'admin') {
      baseLinks.push(
        { href: '/resources', label: 'Resources' },
        { href: '/projects', label: 'Projects' }
      );
    }

    return baseLinks;
  };

  const links = getLinks();

  return (
    <nav className="backdrop-blur-sm bg-white/80 border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-12">
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
            </Link>
            
            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-1">
              {links.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      isActive
                        ? 'bg-gradient-to-r from-orange-500/10 to-pink-500/10 text-orange-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Info and Logout */}
          {user && (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-sm font-medium">
                  {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                <div className="text-sm">
                  <div className="font-medium text-gray-900">{user.full_name}</div>
                  <div className="text-xs text-gray-500 capitalize">
                    {user.role.replace('_', ' ')}
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
