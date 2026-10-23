'use client';

import { useEffect, useMemo } from 'react';
import { Check } from 'lucide-react';
import { PALETTE } from '@/lib/icons';

const PIECES = 36;
const DURATION = 2200;

/**
 * Short full-screen confetti burst + animated check. Non-interactive overlay.
 * With prefers-reduced-motion the confetti is hidden and only the check shows.
 */
export function Celebration({ burstKey, onDone }: { burstKey: number; onDone: () => void }) {
  useEffect(() => {
    if (!burstKey) return;
    const id = setTimeout(onDone, DURATION);
    return () => clearTimeout(id);
  }, [burstKey, onDone]);

  // Random but stable for one burst.
  const pieces = useMemo(
    () => Array.from({ length: PIECES }, (_, i) => {
      const angle = (i / PIECES) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = 120 + Math.random() * 160;
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 60,
        r: Math.round(Math.random() * 720 - 360),
        color: PALETTE[i % PALETTE.length],
        delay: Math.random() * 120,
        round: i % 3 === 0,
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey],
  );

  if (!burstKey) return null;

  return (
    <div key={burstKey} className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center" aria-hidden>
      <style>{`
        @keyframes jinaq-confetti {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translate(var(--x), calc(var(--y) + 220px)) rotate(var(--r)); opacity: 0; }
        }
        @keyframes jinaq-pop {
          0% { transform: scale(0.3); opacity: 0; }
          25% { transform: scale(1.1); opacity: 1; }
          40% { transform: scale(1); }
          85% { opacity: 1; }
          100% { opacity: 0; transform: scale(0.95); }
        }
        .jinaq-pop { animation: jinaq-pop ${DURATION}ms ease-out forwards; }
        /* Reduced motion: a static check that simply disappears with the overlay. */
        @media (prefers-reduced-motion: reduce) { .jinaq-pop { animation: none !important; } }
      `}</style>
      <div className="relative">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="absolute top-1/2 left-1/2 h-2.5 w-1.5 motion-reduce:hidden"
            style={{
              backgroundColor: p.color,
              borderRadius: p.round ? '9999px' : '2px',
              animation: `jinaq-confetti 1.6s cubic-bezier(.15,.7,.35,1) ${p.delay}ms forwards`,
              ['--x' as string]: `${p.x}px`,
              ['--y' as string]: `${p.y}px`,
              ['--r' as string]: `${p.r}deg`,
            }}
          />
        ))}
        <div className="jinaq-pop flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/40">
          <Check className="h-12 w-12" strokeWidth={3} />
        </div>
      </div>
    </div>
  );
}
