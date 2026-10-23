import { LogoMark } from '@/components/brand/logo';

export function SplashScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="h-14 w-14 animate-pulse" />
        <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-[splash_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
      </div>
      <style>{`@keyframes splash{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
    </div>
  );
}
