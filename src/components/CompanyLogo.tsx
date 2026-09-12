'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import Image from 'next/image';
import logosData from '../../public/data/company_logos.json';

interface CompanyLogoProps {
  companyName: string;
  size?: number;
  className?: string;
}

interface LogoEntry {
  company: string;
  slug: string;
  localPath: string | null;
  cdnUrl: string;
}

const logoRegistry = logosData as Record<string, LogoEntry>;

function getMonogram(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, Math.min(2, name.length)).toUpperCase();
}

function getDeterministicGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  const hue2 = (hue + 45) % 360;
  return `linear-gradient(135deg, oklch(0.55 0.18 ${hue}) 0%, oklch(0.38 0.22 ${hue2}) 100%)`;
}

export default function CompanyLogo({
  companyName,
  size = 28,
  className = '',
}: CompanyLogoProps) {
  const entry = logoRegistry[companyName];

  // Multi-tier fallback: 1 (local SVG) -> 2 (CDN) -> 3 (Monogram fallback)
  const initialTier = entry?.localPath ? 1 : entry?.cdnUrl ? 2 : 3;
  const [tier, setTier] = useState<number>(initialTier);

  const handleError = () => {
    if (tier === 1 && entry?.cdnUrl) {
      setTier(2);
    } else {
      setTier(3);
    }
  };

  if (tier === 3 || !entry) {
    const monogram = getMonogram(companyName);
    const gradient = getDeterministicGradient(companyName);
    const fontSize = Math.max(9, Math.floor(size * 0.42));

    return (
      <div
        className={`rounded-lg flex items-center justify-center font-mono font-bold text-white shadow-xs shrink-0 select-none ${className}`}
        style={{
          width: size,
          height: size,
          background: gradient,
          fontSize: `${fontSize}px`,
        }}
        title={companyName}
        aria-label={`${companyName} logo`}
      >
        {monogram}
      </div>
    );
  }

  const currentSrc = tier === 1 ? entry.localPath! : entry.cdnUrl;

  return (
    <div
      className={`rounded-lg bg-secondary/80 border border-border/50 p-1 flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title={companyName}
    >
      <img
        src={currentSrc}
        alt={`${companyName} logo`}
        width={size - 8}
        height={size - 8}
        className="object-contain max-h-full max-w-full"
        onError={handleError}
        loading="lazy"
      />
    </div>
  );
}
