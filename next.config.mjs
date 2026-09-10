import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // Bust stale precache when users keep an old SW after deploy
  cacheStartUrl: true,
  dynamicStartUrl: true,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    // Ensure activate-now behavior on update
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
  },
  // Custom cache name suffix so old Workbox caches are orphaned after deploy
  cacheId: "golf-assistant-v3",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
