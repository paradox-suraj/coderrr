'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Code2, 
  Building2, 
  GitCompare, 
  Command, 
  Flame, 
  BrainCircuit,
  RotateCw,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDueCount } from '@/lib/hooks/useDueCount';
import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/nextjs';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Problems', href: '/problems', icon: Code2 },
  { label: 'Companies', href: '/companies', icon: Building2 },
  { label: 'Compare', href: '/companies/compare', icon: GitCompare },
  { label: 'Review Queue', href: '/review', icon: RotateCw },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { count: dueCount } = useDueCount();

  const isProblemRoute = pathname.startsWith('/problem/');
  const [isCollapsed, setIsCollapsed] = useState(isProblemRoute);

  // Auto-collapse when navigating to /problem/[id]
  useEffect(() => {
    setIsCollapsed(pathname.startsWith('/problem/'));
  }, [pathname]);

  // Keyboard shortcut: '[' or 'Cmd+B' / 'Ctrl+B' to toggle sidebar
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable ||
        target?.closest('.monaco-editor');

      if (isInput) return;

      // '[' shortcut or (Cmd+B / Ctrl+B)
      if (e.key === '[' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        toggleCollapse();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCollapse]);

  return (
    <aside
      className={cn(
        'border-b md:border-b-0 md:border-r border-white/10 bg-[#09090b]/90 backdrop-blur-xl flex md:flex-col justify-between p-3 z-40 shrink-0 select-none transition-[width] duration-200 ease-in-out',
        'w-full',
        isCollapsed ? 'md:w-[68px]' : 'md:w-[240px]'
      )}
    >
      <div className="flex md:flex-col gap-4 w-full items-center md:items-stretch">
        <div className="flex items-center justify-between w-full">
          {/* Brand Header */}
          <Link
            href="/"
            className={cn(
              'flex items-center gap-2.5 group px-1 py-1 transition-all',
              isCollapsed && 'md:justify-center md:w-full md:px-0'
            )}
            title="AlgoJeet Pro — Dashboard"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-xs group-hover:scale-105 transition-transform duration-200 shrink-0">
              <BrainCircuit className="w-4 h-4 text-emerald-400" />
            </div>
            {!isCollapsed && (
              <div className="hidden md:block">
                <div className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
                  <span>AlgoJeet</span>
                  <span className="text-[10px] font-mono tracking-wider px-1.5 py-0.2 rounded-full bg-white/[0.08] text-neutral-300 border border-white/10">
                    PRO
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 font-mono tabular-nums">
                  3,358 Questions • 654 Companies
                </div>
              </div>
            )}
          </Link>

          {/* Desktop Toggle Button */}
          {!isCollapsed && (
            <button
              onClick={toggleCollapse}
              className="hidden md:flex p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Collapse sidebar ([ or Cmd+B)"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}

          {/* Mobile Auth Controls */}
          <div className="md:hidden flex items-center gap-2">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-neutral-200 border border-white/10 transition-colors cursor-pointer">
                  Sign In
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'w-7 h-7 ring-1 ring-white/20',
                  },
                }}
              />
            </Show>
          </div>
        </div>

        {/* Collapsed expand toggle button for desktop rail */}
        {isCollapsed && (
          <div className="hidden md:flex justify-center w-full pb-1 border-b border-white/10">
            <button
              onClick={toggleCollapse}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Expand sidebar ([ or Cmd+B)"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex md:flex-col gap-1 w-full overflow-x-auto md:overflow-visible">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? `${item.label}${item.href === '/review' && dueCount > 0 ? ` (${dueCount} due)` : ''}` : undefined}
                className={cn(
                  'flex items-center rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap relative',
                  isCollapsed
                    ? 'md:justify-center md:px-0 md:py-2.5 px-3 py-2'
                    : 'justify-between px-3 py-2',
                  isActive
                    ? 'bg-white/[0.08] text-white font-semibold before:absolute before:left-0 before:w-0.5 before:h-4 before:bg-emerald-500 before:rounded-r'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
                )}
              >
                <div className={cn('flex items-center gap-2.5', isCollapsed && 'md:gap-0')}>
                  <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-emerald-400' : 'text-neutral-400')} />
                  {!isCollapsed && <span>{item.label}</span>}
                </div>
                {item.href === '/review' && dueCount > 0 && (
                  <span
                    className={cn(
                      'rounded-full bg-rose-500/20 text-rose-400 font-mono border border-rose-500/30 shrink-0',
                      isCollapsed
                        ? 'md:absolute md:top-1 md:right-1.5 md:w-2 md:h-2 md:p-0'
                        : 'px-1.5 py-0.5 text-[10px]'
                    )}
                  >
                    {!isCollapsed && dueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Pinned Status Box */}
      <div className="hidden md:flex flex-col gap-2.5 pt-3 border-t border-white/10">
        {/* Auth Controls */}
        <div className={cn('px-1', isCollapsed && 'px-0 flex justify-center')}>
          <Show when="signed-out">
            {!isCollapsed ? (
              <div className="flex items-center gap-2">
                <SignInButton mode="modal">
                  <button className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 hover:text-white border border-white/10 transition-colors cursor-pointer text-center">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer text-center">
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            ) : (
              <SignInButton mode="modal">
                <button
                  className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 border border-white/10 text-xs transition-colors cursor-pointer"
                  title="Sign In"
                >
                  <Command className="w-3.5 h-3.5" />
                </button>
              </SignInButton>
            )}
          </Show>
          <Show when="signed-in">
            <div className={cn('flex items-center gap-2.5 py-0.5', isCollapsed && 'justify-center')}>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'w-7 h-7 ring-1 ring-white/20',
                  },
                }}
              />
              {!isCollapsed && <span className="text-xs text-neutral-300 font-medium">My Account</span>}
            </div>
          </Show>
        </div>

        {/* Daily Streak Indicator */}
        <div
          className={cn(
            'flex items-center text-xs',
            isCollapsed ? 'justify-center py-1' : 'justify-between px-1'
          )}
          title="Daily Streak: 3 Days"
        >
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            {!isCollapsed && <span>Daily Streak</span>}
          </div>
          <span className={cn('font-mono font-semibold text-neutral-200 tabular-nums', isCollapsed && 'text-[10px]')}>
            3D
          </span>
        </div>

        {/* Quick Find (⌘K) button */}
        <button
          onClick={() => {
            const event = new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              bubbles: true,
            });
            window.dispatchEvent(event);
          }}
          title="Quick Find (⌘K)"
          className={cn(
            'flex items-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-neutral-400 hover:text-neutral-200 border border-white/10 transition-colors cursor-pointer',
            isCollapsed ? 'justify-center p-2' : 'justify-between w-full px-2.5 py-1.5'
          )}
        >
          <span className="flex items-center gap-2">
            <Command className="w-3.5 h-3.5" />
            {!isCollapsed && <span>Quick Find</span>}
          </span>
          {!isCollapsed && (
            <kbd className="font-mono text-[10px] bg-white/[0.06] text-neutral-400 px-1.5 py-0.5 rounded border border-white/10">
              ⌘K
            </kbd>
          )}
        </button>

        {/* Creator Attribution */}
        {!isCollapsed && (
          <div className="text-[11px] text-neutral-500 text-center pt-0.5 px-1">
            Created by{' '}
            <a
              href="https://www.instagram.com/paradox.suraj/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-emerald-400 transition-colors underline underline-offset-2 decoration-white/20 hover:decoration-emerald-400 font-medium"
            >
              Paradox Suraj
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
