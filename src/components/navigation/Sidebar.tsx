'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Code2, 
  Building2, 
  GitCompare, 
  Command, 
  Flame, 
  BrainCircuit 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Cockpit', href: '/', icon: LayoutDashboard },
  { label: 'Problems', href: '/problems', icon: Code2 },
  { label: 'Companies', href: '/companies', icon: Building2 },
  { label: 'ROI Compare', href: '/companies/compare', icon: GitCompare },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full md:w-[240px] border-b md:border-b-0 md:border-r border-white/[0.08] bg-[#09090b]/80 backdrop-blur-xl flex md:flex-col justify-between p-3.5 z-40 shrink-0 select-none">
      <div className="flex md:flex-col gap-5 w-full items-center md:items-stretch">
        {/* Brand Header */}
        <Link href="/" className="flex items-center gap-2.5 group px-1 py-1">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-xs group-hover:scale-105 transition-transform duration-200">
            <BrainCircuit className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="hidden md:block">
            <div className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>AlgoJeet</span>
              <span className="text-[10px] font-mono tracking-wider px-1.5 py-0.2 rounded-full bg-white/[0.08] text-neutral-300 border border-white/[0.08]">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-neutral-500 font-mono tabular-nums">
              3,358 Questions • 654 Orgs
            </div>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="flex md:flex-col gap-1 w-full overflow-x-auto md:overflow-visible">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap relative',
                  isActive
                    ? 'bg-white/[0.06] text-white before:absolute before:left-0 before:w-0.5 before:h-4 before:bg-emerald-500 before:rounded-r font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]'
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-emerald-400' : 'text-neutral-500')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Pinned Cockpit Status Box */}
      <div className="hidden md:flex flex-col gap-2.5 pt-3 border-t border-white/[0.08]">
        <div className="flex items-center justify-between px-1 text-xs">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Daily Streak</span>
          </div>
          <span className="font-mono font-semibold text-neutral-200 tabular-nums">3 Days</span>
        </div>

        <button
          onClick={() => {
            const event = new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              bubbles: true,
            });
            window.dispatchEvent(event);
          }}
          className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-neutral-400 hover:text-neutral-200 border border-white/[0.08] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Command className="w-3.5 h-3.5" />
            <span>Quick Find</span>
          </span>
          <kbd className="font-mono text-[10px] bg-white/[0.06] text-neutral-400 px-1.5 py-0.5 rounded border border-white/[0.08]">
            ⌘K
          </kbd>
        </button>
      </div>
    </aside>
  );
}
