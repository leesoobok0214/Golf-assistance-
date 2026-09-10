"use client";

import { useEffect } from "react";

/**
 * One-time hard reset of service workers + caches after deploy,
 * so history/detail never keep a crashing old bundle.
 */
export default function ServiceWorkerRefresh() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const HARD = "golf-assistant-sw-hard-reset-v5";
    const BUST = "golf-assistant-sw-bust-v5";

    const run = async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();

        const hardDone = localStorage.getItem(HARD);
        if (!hardDone) {
          localStorage.setItem(HARD, "1");
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          await Promise.all(
            regs.map((r) => r.unregister().catch(() => undefined))
          );
          window.location.reload();
          return;
        }

        await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
        if (!sessionStorage.getItem(BUST)) {
          sessionStorage.setItem(BUST, "1");
        }
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
