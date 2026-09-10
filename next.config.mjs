import withPWAInit, { runtimeCaching as defaultRuntimeCaching } from "@ducanh2912/next-pwa";

/** Never cache opaque/error document/RSC responses. */
const noOpaqueCache = {
  cacheableResponse: {
    statuses: [200],
  },
};

/**
 * Build runtimeCaching with correct Workbox order:
 * dynamic NetworkOnly routes must come before the pages catch-all,
 * but pages* must still come AFTER static asset rules.
 */
function buildRuntimeCaching() {
  const dynamicAppPages = {
    urlPattern: ({ url: { pathname }, sameOrigin }) => {
      if (!sameOrigin) return false;
      return (
        pathname === "/rounds" ||
        pathname.startsWith("/rounds/") ||
        pathname === "/add" ||
        pathname.startsWith("/add/") ||
        pathname === "/scan" ||
        pathname.startsWith("/scan/") ||
        pathname === "/history" ||
        pathname.startsWith("/history/") ||
        pathname === "/stats" ||
        pathname.startsWith("/stats/")
      );
    },
    handler: "NetworkOnly",
    options: {
      cacheName: "dynamic-app-pages",
    },
  };

  const softenPagesEntry = (entry) => {
    const name = entry.options?.cacheName;
    if (name !== "pages" && name !== "pages-rsc" && name !== "pages-rsc-prefetch") {
      return entry;
    }
    return {
      ...entry,
      handler: "NetworkFirst",
      options: {
        ...entry.options,
        networkTimeoutSeconds: 5,
        ...noOpaqueCache,
      },
    };
  };

  // Insert NetworkOnly for dynamic app routes immediately before the pages catch-all
  const result = [];
  let insertedDynamic = false;
  for (const entry of defaultRuntimeCaching) {
    const name = entry.options?.cacheName;
    if (!insertedDynamic && name === "pages-rsc-prefetch") {
      result.push(dynamicAppPages);
      insertedDynamic = true;
    }
    result.push(softenPagesEntry(entry));
  }
  if (!insertedDynamic) {
    result.push(dynamicAppPages);
  }
  return result;
}

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
  // Full ordered list (do not extend — custom pages* must stay after static assets)
  extendDefaultRuntimeCaching: false,
  workboxOptions: {
    // Ensure activate-now behavior on update
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    // Prefix Workbox caches so old v3 (and earlier) caches are orphaned after deploy
    cacheId: "golf-assistant-v5",
    runtimeCaching: buildRuntimeCaching(),
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
