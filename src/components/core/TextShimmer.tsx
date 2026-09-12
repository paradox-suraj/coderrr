'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface TextShimmerProps {
  children: React.ReactNode;
  as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'h4';
  className?: string;
  duration?: number;
}

export function TextShimmer({
  children,
  as: Component = 'span',
  className,
  duration = 2.5,
}: TextShimmerProps) {
  return (
    <Component
      className={cn(
        'inline-flex animate-text-shimmer bg-clip-text text-transparent font-medium',
        'bg-[linear-gradient(110deg,#10b981_0%,#ffffff_45%,#6366f1_75%,#10b981_100%)]',
        'bg-[length:250%_100%] select-none',
        className
      )}
      style={{
        animationDuration: `${duration}s`,
      }}
    >
      {children}
    </Component>
  );
}

export default TextShimmer;
