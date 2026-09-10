"use client";

import { useEffect } from "react";

/**
 * Force service worker update + clear outdated Workbox caches so users
 * don't keep a stale JS bundle that still crashes on legacy rounds.
 */
export default function ServiceWorkerRefresh() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const CACHE_BUST_KEY = "golf-assistant-sw-bust-v3";

    const run = async () => {
      try {
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
