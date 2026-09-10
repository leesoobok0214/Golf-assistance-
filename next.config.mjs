import withPWAInit from "@ducanh2912/next-pwa";

/**
 * PWA service worker DISABLED for stability.
 * Android was serving broken cached bundles; keep manifest/icons for later.
 */
const withPWA = withPWAInit({
  dest: "public",
  disable: true,
  register: false,
  fallbacks: {
    document: "/offline",
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
