'use client';

import React, { useState, useEffect } from 'react';
import { X, Server, Key, Check, Copy, AlertTriangle, Cpu, Terminal, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SandboxSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SandboxSettingsModal({ isOpen, onClose }: SandboxSettingsModalProps) {
  const [pistonUrl, setPistonUrl] = useState('');
  const [pistonKey, setPistonKey] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedDocker, setCopiedDocker] = useState(false);

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      setPistonUrl(localStorage.getItem('algojeet_piston_url') || '');
      setPistonKey(localStorage.getItem('algojeet_piston_key') || '');
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      if (pistonUrl.trim()) {
        localStorage.setItem('algojeet_piston_url', pistonUrl.trim());
      } else {
        localStorage.removeItem('algojeet_piston_url');
      }

      if (pistonKey.trim()) {
        localStorage.setItem('algojeet_piston_key', pistonKey.trim());
      } else {
        localStorage.removeItem('algojeet_piston_key');
      }
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const handleReset = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('algojeet_piston_url');
      localStorage.removeItem('algojeet_piston_key');
    }
    setPistonUrl('');
    setPistonKey('');
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const dockerCommand = 'docker run --privileged -v piston_data:/piston -d -p 2000:2000 --name piston_api ghcr.io/engineer-man/piston';

  const handleCopyDocker = () => {
    navigator.clipboard.writeText(dockerCommand);
    setCopiedDocker(true);
    setTimeout(() => setCopiedDocker(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg rounded-2xl bg-neutral-900 border border-white/10 shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-neutral-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Cloud Sandbox Settings (C++ & Java)
              </h2>
              <p className="text-[11px] text-neutral-400">
                Configure custom remote execution clusters or self-hosted Piston instances
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex flex-col gap-4 text-xs">
          {/* Important Upstream Notice Banner */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Public Piston API Whitelist Notice (Feb 15, 2026)</span>
            </div>
            <p className="text-[11px] text-amber-200/90 leading-relaxed font-sans">
              The public Piston cluster (<code className="text-white bg-black/30 px-1 py-0.5 rounded font-mono">emkc.org</code>)
              became <strong>whitelist-only</strong> to prevent free-tier abuse, bot traffic, and crypto mining.
              Public unauthenticated requests now return HTTP 401.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-medium mt-1">
              <Cpu className="w-3.5 h-3.5 shrink-0" />
              <span>Tip: Switch to <strong>Python 3</strong> or <strong>JavaScript</strong> in the dropdown for 100% offline in-browser execution with zero setup!</span>
            </div>
          </div>

          {/* Form: Custom Endpoint */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-neutral-200 flex items-center justify-between">
              <span>Execution Endpoint URL</span>
              <button
                type="button"
                onClick={() => setPistonUrl('http://localhost:2000/api/v2/execute')}
                className="text-[10px] text-sky-400 hover:underline cursor-pointer"
              >
                Use Localhost:2000
              </button>
            </label>
            <input
              type="text"
              value={pistonUrl}
              onChange={(e) => setPistonUrl(e.target.value)}
              placeholder="https://emkc.org/api/v2/piston/execute (default)"
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-white/10 text-neutral-200 placeholder:text-neutral-600 font-mono text-xs focus:outline-none focus:border-sky-500/50"
            />
            <span className="text-[10px] text-neutral-500">
              Leave blank to use the default endpoint, or enter your self-hosted instance URL. (Requests are securely routed through our /api/execute proxy).
            </span>
          </div>

          {/* Form: Custom API Key */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-neutral-200 flex items-center gap-1.5">
              <Key className="w-3 h-3 text-neutral-400" />
              <span>Authorization Key / Token (Optional)</span>
            </label>
            <input
              type="password"
              value={pistonKey}
              onChange={(e) => setPistonKey(e.target.value)}
              placeholder="e.g. Bearer your-api-token"
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-white/10 text-neutral-200 placeholder:text-neutral-600 font-mono text-xs focus:outline-none focus:border-sky-500/50"
            />
            <span className="text-[10px] text-neutral-500">
              If your custom or approved Piston server requires an Authorization header, provide it here.
            </span>
          </div>

          {/* Self-Hosting 1-Liner Guide */}
          <div className="p-3 rounded-xl bg-neutral-950 border border-white/[0.08] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5 text-[11px]">
                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                <span>Run Free Local Piston Sandbox (Docker)</span>
              </span>
              <button
                type="button"
                onClick={handleCopyDocker}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] transition-colors cursor-pointer"
              >
                {copiedDocker ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedDocker ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-2 rounded bg-neutral-900 border border-white/[0.05] font-mono text-[10.5px] text-neutral-300 overflow-x-auto select-all">
              {dockerCommand}
            </pre>
            <span className="text-[10px] text-neutral-500 leading-normal">
              After running this command, click &ldquo;Use Localhost:2000&rdquo; above and hit Save to execute C++ and Java entirely locally!
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-white/[0.08] flex items-center justify-between bg-neutral-950/50">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white text-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-neutral-950 text-xs font-bold transition-all shadow-[0_0_15px_rgba(14,165,233,0.35)] cursor-pointer"
            >
              {savedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{savedSuccess ? 'Saved!' : 'Save & Apply'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
