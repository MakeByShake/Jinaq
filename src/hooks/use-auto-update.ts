'use client';

import { useEffect } from 'react';

const BUILD = process.env.NEXT_PUBLIC_BUILD ?? 'dev';

/**
 * An installed PWA can stay open for days with old code in memory.
 * When the user comes back to the app and a newer version is deployed, reload once.
 */
export function useAutoUpdate() {
  useEffect(() => {
    if (BUILD === 'dev') return;
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState !== 'visible') return;
      checking = true;
      try {
        const res = await fetch('/version', { cache: 'no-store' });
        const { build } = (await res.json()) as { build?: string };
        if (build && build !== 'dev' && build !== BUILD) window.location.reload();
      } catch {
        // Offline — try again next time.
      } finally {
        checking = false;
      }
    };
    check();
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, 15 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(timer);
    };
  }, []);
}
