'use client';

import { useEffect, useRef } from 'react';

interface CelebrationCanvasProps {
  active: boolean;
  onComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  type: 'confetti' | 'emoji';
  emoji?: string;
}

const EMOJIS = ['🎉', '🚀', '🏆', '💎', '✨', '💯', '🔥', '⭐', '🌟', '🦄', '🎯', '👑'];
const COLORS = [
  '#10b981', // emerald
  '#34d399', // light emerald
  '#6366f1', // indigo
  '#818cf8', // light indigo
  '#f59e0b', // amber
  '#fbbf24', // gold
  '#ec4899', // pink
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#a855f7', // purple
];

export default function CelebrationCanvas({ active, onComplete }: CelebrationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to window size
    const updateSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateSize();

    // Create 130 particles (80 confetti ribbons + 50 creative floating emojis)
    const particles: Particle[] = [];
    const particleCount = 130;

    for (let i = 0; i < particleCount; i++) {
      const isEmoji = i % 3 === 0; // ~33% creative emojis
      const startX = canvas.width * (0.2 + Math.random() * 0.6); // spread across center 60%
      const startY = canvas.height * (0.5 + Math.random() * 0.3); // launch from mid-lower screen

      particles.push({
        x: startX,
        y: startY,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 16 - 7, // launch upwards
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        size: isEmoji ? 24 + Math.random() * 12 : 8 + Math.random() * 8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 1,
        decay: 0.006 + Math.random() * 0.008,
        type: isEmoji ? 'emoji' : 'confetti',
        emoji: isEmoji ? EMOJIS[Math.floor(Math.random() * EMOJIS.length)] : undefined,
      });
    }

    let animationFrameId: number;
    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let aliveCount = 0;

      for (const p of particles) {
        if (p.alpha <= 0.01) continue;

        aliveCount++;

        // Apply physics
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38; // gravity
        p.vx *= 0.985; // air drag
        p.rotation += p.vRot;
        p.alpha = Math.max(0, p.alpha - p.decay);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);

        if (p.type === 'emoji' && p.emoji) {
          ctx.font = `${p.size}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.emoji, 0, 0);
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        }

        ctx.restore();
      }

      if (aliveCount > 0) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        isRunning = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onComplete?.();
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 w-full h-full"
      style={{ pointerEvents: 'none' }}
    />
  );
}
