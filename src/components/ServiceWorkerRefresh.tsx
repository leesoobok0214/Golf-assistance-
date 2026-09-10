"use client";

import { useEffect } from "react";

/**
 * Gut: unregister any leftover service workers + caches once.
 * No auto-reload. PWA SW is disabled in next.config.
 */
export default function ServiceWorkerRefresh() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const KEY = "golf-assistant-sw-disabled-v1";
    if (localStorage.getItem(KEY)) return;

    const run = async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs.map((r) => r.unregister().catch(() => undefined))
        );
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        localStorage.setItem(KEY, "1");
      } catch (err) {
        console.warn("SW unregister skipped", err);
      }
    };

    void run();
  }, []);

  return null;
}
