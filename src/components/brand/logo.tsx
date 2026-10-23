import { useId } from 'react';
import { cn } from '@/lib/utils';

/** The Jinaq mark: a "J" with a golden sprout — savings that grow. */
export function LogoMark({ className, title = 'Jinaq' }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" fill="none" className={cn('h-9 w-9 shrink-0', className)} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${id}bg`} x1="6" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#19C37D" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <linearGradient id={`${id}leaf`} x1="36" y1="6" x2="54" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FDE68A" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}bg)`} />
      <path d="M36 27v11.5a9.5 9.5 0 0 1-19 0" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M36 25.5c0-9.5 5.6-14.5 15-14.5 0 9-5.6 14.5-15 14.5Z" fill={`url(#${id}leaf)`} />
      <path d="M34.5 25.5C34.5 19 30.6 15 24 15c0 6.3 3.9 10.5 10.5 10.5Z" fill="#FCD34D" fillOpacity=".85" />
    </svg>
  );
}

export function Logo({ className, markClassName, showText = true }: { className?: string; markClassName?: string; showText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={markClassName} />
      {showText && (
        <span className="font-display text-lg font-semibold tracking-tight lowercase">jinaq</span>
      )}
    </span>
  );
}
