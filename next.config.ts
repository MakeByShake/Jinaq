import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old routes from the first version of the app keep working.
  async redirects() {
    return [
      { source: "/dashboard/income", destination: "/dashboard/recurring", permanent: true },
      { source: "/dashboard/history", destination: "/dashboard/transactions", permanent: true },
      { source: "/dashboard/wishlist", destination: "/dashboard/goals", permanent: true },
      { source: "/dashboard/calculations", destination: "/dashboard/planner", permanent: true },
      { source: "/dashboard/profile", destination: "/dashboard/settings", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
