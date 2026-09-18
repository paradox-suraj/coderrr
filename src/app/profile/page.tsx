'use client';

import { UserProfile, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, BrainCircuit, Flame, KeyRound, Download, Upload, Database, ShieldAlert, ShieldCheck } from 'lucide-react';
import { db, downloadDatabaseBackup, importDatabaseFromJson } from '@/lib/db';
import { SpotlightCard } from '@/components/core/SpotlightCard';
import { isClerkConfigured } from '@/lib/auth/clerkConfig';
import { checkStoragePersistence, requestStoragePersistence, type StorageStatus } from '@/lib/storage/persistence';
import { cn } from '@/lib/utils';

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
  const [isExporting, setIsExporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({
    isSupported: false,
    isPersisted: false,
  });
  const [isRequestingPersist, setIsRequestingPersist] = useState(false);
  const isAuthReady = isClerkConfigured();

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

  useEffect(() => {
    loadStats();
    checkStoragePersistence().then(setStorageStatus);
  }, []);

  const handleRequestPersistence = async () => {
    setIsRequestingPersist(true);
    await requestStoragePersistence();
    const updated = await checkStoragePersistence();
    setStorageStatus(updated);
    setIsRequestingPersist(false);
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await downloadDatabaseBackup();
    } catch (err: any) {
      alert('Failed to export data: ' + (err?.message || String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportStatus('Importing backup...');
      const text = await file.text();
      const res = await importDatabaseFromJson(text);
      setImportStatus(`✅ Successfully restored ${res.progressCount} progress records, ${res.codeCount} code drafts, and ${res.sprintCount} sprints!`);
      await loadStats();
    } catch (err: any) {
      setImportStatus(`❌ Import failed: ${err?.message || String(err)}`);
    }
  };

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

      {/* Data Backup & Portability Section */}
      <div className="glass-card p-6 rounded-2xl border border-white/[0.08] flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-white">Data Portability & Offline Backup</h2>
            <p className="text-xs text-neutral-400">
              Export your entire local solve history, code notes, and SM-2 flashcard schedules to JSON or restore from a backup.
            </p>
          </div>
        </div>

        {/* Storage Persistence Status Badge & Action */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            {storageStatus.isPersisted ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
                Persistent Storage:
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-mono font-bold',
                    storageStatus.isPersisted
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  )}
                >
                  {storageStatus.isPersisted ? 'Active (Protected)' : 'Best-Effort'}
                </span>
              </span>
              <span className="text-[11px] text-neutral-400">
                {storageStatus.isPersisted
                  ? `Browser eviction shield active. Storage usage: ~${storageStatus.usageMb || 0} MB.`
                  : 'Storage may be evicted by the browser if disk is low or after 7 days on Safari.'}
              </span>
            </div>
          </div>

          {!storageStatus.isPersisted && storageStatus.isSupported && (
            <button
              onClick={handleRequestPersistence}
              disabled={isRequestingPersist}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold border border-amber-500/30 transition-all cursor-pointer whitespace-nowrap"
            >
              {isRequestingPersist ? 'Requesting...' : 'Enable Persistent Storage'}
            </button>
          )}
        </div>

        {/* Safari 7-Day Purge Advisory */}
        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-200/90 flex flex-col gap-1">
          <span className="font-semibold flex items-center gap-1.5 text-amber-300">
            <ShieldAlert className="w-3.5 h-3.5" />
            Apple Safari & iOS WebKit 7-Day Storage Purge Notice
          </span>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Safari and WebKit browsers automatically purge IndexedDB data after 7 days without user interaction unless persistent storage is granted or the app is installed as a PWA on your home screen. Export your data to JSON regularly or sign in for cloud sync.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold border border-primary/20 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? 'Exporting...' : 'Export My Data (.json)'}
          </button>

          <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-white text-xs font-semibold border border-white/[0.1] transition-all cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Import Backup
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>
        </div>

        {importStatus && (
          <p className="text-xs font-mono text-neutral-300 bg-white/[0.04] p-3 rounded-lg border border-white/[0.06]">
            {importStatus}
          </p>
        )}
      </div>

      {/* Account Section */}
      {isAuthReady ? <ClerkUserProfileSection /> : <UnconfiguredClerkNotice />}
    </div>
  );
}

