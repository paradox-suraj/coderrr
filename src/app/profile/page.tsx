'use client';

import { UserProfile, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, BrainCircuit, Flame, KeyRound } from 'lucide-react';
import { db } from '@/lib/db';
import { SpotlightCard } from '@/components/core/SpotlightCard';
import { isClerkConfigured } from '@/lib/auth/clerkConfig';

function ClerkUserProfileSection() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="py-8 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-white">
          {user?.firstName ? `${user.firstName}'s Account` : 'Account Details'}
        </h2>
        <p className="text-xs text-neutral-400">Manage your connected accounts, email, and authentication methods</p>
      </div>
      <div className="rounded-xl overflow-hidden">
        <UserProfile />
      </div>
    </div>
  );
}

function UnconfiguredClerkNotice() {
  return (
    <div className="glass-card p-6 rounded-2xl border border-white/[0.08] flex flex-col sm:flex-row items-start gap-4">
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
        <KeyRound className="w-5 h-5" />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-white">Cloud Authentication Setup</h3>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Your problem progress and code buffers are currently stored safely offline in your browser&apos;s IndexedDB. To enable cross-device cloud sync, add your Clerk keys to <code className="bg-white/[0.08] px-1 rounded text-neutral-200">.env.local</code>.
        </p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [stats, setStats] = useState({ solved: 0, due: 0, totalSprints: 0 });
  const isAuthReady = isClerkConfigured();

  useEffect(() => {
    async function loadStats() {
      const progress = await db.userProgress.toArray();
      const solved = progress.filter((p) => p.status === 'solved').length;
      const nowIso = new Date().toISOString();
      const due = progress.filter(
        (p) => p.status === 'solved' && p.nextReviewDate && p.nextReviewDate <= nowIso
      ).length;
      const sprints = await db.sprints.count();
      setStats({ solved, due, totalSprints: sprints });
    }
    loadStats();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8">
      {/* Back nav */}
      <Link
        href="/"
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Dashboard
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Profile & Stats
        </h1>
        <p className="text-sm text-muted-foreground">
          Your AlgoJeet Pro statistics, retention queue, and settings
        </p>
      </div>

      {/* Stats tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SpotlightCard className="p-4 flex flex-col gap-1.5 glass-card rounded-xl">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Problems Solved
          </div>
          <span className="text-2xl font-bold font-mono tabular-nums text-white">
            {stats.solved}
          </span>
        </SpotlightCard>
        <SpotlightCard className="p-4 flex flex-col gap-1.5 glass-card rounded-xl">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <BrainCircuit className="w-3.5 h-3.5 text-rose-400" />
            Reviews Due
          </div>
          <span className="text-2xl font-bold font-mono tabular-nums text-white">
            {stats.due}
          </span>
        </SpotlightCard>
        <SpotlightCard className="p-4 flex flex-col gap-1.5 glass-card rounded-xl">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Sprints Completed
          </div>
          <span className="text-2xl font-bold font-mono tabular-nums text-white">
            {stats.totalSprints}
          </span>
        </SpotlightCard>
      </div>

      {/* Account Section */}
      {isAuthReady ? <ClerkUserProfileSection /> : <UnconfiguredClerkNotice />}
    </div>
  );
}

