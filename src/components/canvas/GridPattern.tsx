import React, { useId } from 'react';
import { cn } from '@/lib/utils';

interface GridPatternProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  dotSize?: number;
  className?: string;
}

export default function GridPattern({
  size = 32,
  dotSize = 1.25,
  className,
  ...props
}: GridPatternProps) {
  const patternId = useId();
  const maskId = useId();

  return (
    <svg
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full stroke-neutral-800/60 fill-neutral-800/60',
        className
      )}
      {...props}
    >
      <defs>
        {/* Fine 32px Radial Dot Grid */}
        <pattern
          id={patternId}
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
          patternContentUnits="userSpaceOnUse"
          x="0"
          y="0"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={dotSize}
            className="fill-zinc-600/30 dark:fill-zinc-400/20"
          />
        </pattern>

        {/* Center / Radial Vignette Mask */}
        <radialGradient id={maskId} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.8" />
          <stop offset="50%" stopColor="white" stopOpacity="0.5" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>

        <mask id={`mask-${maskId}`}>
          <rect width="100%" height="100%" fill={`url(#${maskId})`} />
        </mask>
      </defs>

      {/* Masked Grid Layer */}
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill={`url(#${patternId})`}
        mask={`url(#mask-${maskId})`}
      />
    </svg>
  );
}
