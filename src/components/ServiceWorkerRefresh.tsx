"use client";

import { useEffect } from "react";

/**
 * Force service worker update + clear outdated Workbox caches so users
 * don't keep a stale JS bundle that still crashes on legacy rounds.
 *
 * v4: one-time hard reset (unregister all SWs + clear caches + reload once)
 * when migrating off older cacheId / stale pages caches.
 */
export default function ServiceWorkerRefresh() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const HARD_RESET_KEY = "golf-assistant-sw-hard-reset-v4";
    const CACHE_BUST_KEY = "golf-assistant-sw-bust-v4";

    const run = async () => {
      try {
        // One-time hard reset after v4 deploy — flag set before reload to avoid loops
        if (!localStorage.getItem(HARD_RESET_KEY)) {
          let shouldReload = false;

          if ("caches" in window) {
            const keys = await caches.keys();
            const hasOldCacheId = keys.some(
              (k) =>
                /golf-assistant-v[123](?:-|$)/i.test(k) ||
                (/golf-assistant/i.test(k) && !/golf-assistant-v4/i.test(k))
            );
            const hasStaleAppCaches = keys.some(
              (k) =>
                /golf-assistant/i.test(k) ||
                /workbox|next-static|pages-rsc|^pages$|start-url|NElDvuIp1rFv/i.test(
                  k
                )
            );

            if (hasOldCacheId || hasStaleAppCaches) {
              await Promise.all(keys.map((k) => caches.delete(k)));
              shouldReload = true;
            }
          }

          const regs = await navigator.serviceWorker.getRegistrations();
          if (regs.length > 0) {
            await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
            shouldReload = true;
          }

          localStorage.setItem(HARD_RESET_KEY, "1");

          if (shouldReload) {
            window.location.reload();
            return;
          }
        }

        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update().catch(() => undefined)));

        const already = sessionStorage.getItem(CACHE_BUST_KEY);
        if (already) return;

        if ("caches" in window) {
          const keys = await caches.keys();
          // Drop old next-static / pages caches; Workbox will repopulate
          await Promise.all(
            keys
              .filter(
                (k) =>
                  /next-static|pages-rsc|pages$|start-url|workbox/i.test(k) ||
                  k.includes("NElDvuIp1rFv")
              )
              .map((k) => caches.delete(k))
          );
        }

        sessionStorage.setItem(CACHE_BUST_KEY, "1");

        // If a waiting worker exists, activate it
        for (const reg of regs) {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        }
      } catch (err) {
        console.warn("SW refresh skipped", err);
      }
    };

    void run();
  }, []);

  return null;
}
