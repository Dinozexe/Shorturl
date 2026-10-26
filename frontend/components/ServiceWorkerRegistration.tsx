'use client';

import { useEffect } from 'react';

/** Register only on production HTTPS builds; API responses and authenticated data stay out of the cache. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  return null;
}
