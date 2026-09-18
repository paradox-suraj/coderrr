'use client';

import React from 'react';
import { ChevronDown, Cpu, Cloud, Check, Settings } from 'lucide-react';
import { SupportedLanguage } from '@/lib/db';
import { LANGUAGE_CONFIGS } from '@/lib/runners/codeExecutor';
import { cn } from '@/lib/utils';
import SandboxSettingsModal from './SandboxSettingsModal';

interface LanguageSelectorProps {
  currentLanguage: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  disabled?: boolean;
}

export default function LanguageSelector({
  currentLanguage,
  onLanguageChange,
  disabled = false,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [pistonConfigured, setPistonConfigured] = React.useState<boolean>(true);
  const currentConfig = LANGUAGE_CONFIGS[currentLanguage];

  React.useEffect(() => {
    fetch('/api/health/execution')
      .then((r) => r.json())
      .then((data) => {
        if (data?.piston && typeof data.piston.configured === 'boolean') {
          setPistonConfigured(data.piston.configured);
        }
      })
      .catch(() => {});
  }, []);

  const isCurrentUnconfigured = currentConfig.runtimeType !== 'wasm' && !pistonConfigured;

  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center gap-2">
        {/* Language Selection Dropdown Trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/70 hover:bg-secondary text-xs font-semibold text-foreground border border-border/60 transition-all cursor-pointer select-none',
            disabled && 'opacity-60 cursor-not-allowed'
          )}
        >
          <span>{currentConfig.label}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {/* Runtime Environment Badge */}
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border',
            currentConfig.runtimeType === 'wasm'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : isCurrentUnconfigured
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
          )}
        >
          {currentConfig.runtimeType === 'wasm' ? (
            <Cpu className="w-3 h-3" />
          ) : (
            <Cloud className="w-3 h-3" />
          )}
          <span>{isCurrentUnconfigured ? 'Setup Needed' : currentConfig.runtimeLabel}</span>
        </span>

        {/* Sandbox Settings Trigger for Cloud Runners */}
        {currentConfig.runtimeType !== 'wasm' && (
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={cn(
              "p-1 rounded-md transition-colors cursor-pointer border",
              isCurrentUnconfigured
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                : "bg-secondary/60 hover:bg-secondary text-neutral-400 hover:text-white border-border/60"
            )}
            title="Configure Cloud Sandbox / Piston Cluster"
          >
            <Settings className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Cloud Sandbox Settings Modal */}
      <SandboxSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute left-0 mt-2 w-56 rounded-xl bg-card border border-border/80 shadow-2xl p-1.5 z-50 flex flex-col gap-1 ring-1 ring-white/10 animate-in fade-in-50 zoom-in-95 duration-100">
            {(Object.keys(LANGUAGE_CONFIGS) as SupportedLanguage[]).map((langKey) => {
              const cfg = LANGUAGE_CONFIGS[langKey];
              const isSelected = langKey === currentLanguage;
              const isCloudUnconfigured = cfg.runtimeType !== 'wasm' && !pistonConfigured;

              return (
                <button
                  key={langKey}
                  onClick={() => {
                    onLanguageChange(langKey);
                    setIsOpen(false);
                    if (isCloudUnconfigured) {
                      setIsSettingsOpen(true);
                    }
                  }}
                  className={cn(
                    'flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left',
                    isSelected
                      ? 'bg-primary/15 text-primary font-semibold'
                      : 'hover:bg-secondary text-foreground'
                  )}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{cfg.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {cfg.version}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded font-mono',
                        cfg.runtimeType === 'wasm'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : isCloudUnconfigured
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-sky-500/10 text-sky-400'
                      )}
                    >
                      {cfg.runtimeType === 'wasm'
                        ? 'WASM'
                        : isCloudUnconfigured
                        ? 'Setup Needed'
                        : 'Cloud'}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
