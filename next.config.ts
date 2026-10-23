import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Docker runs the small standalone server; Vercel builds its own output.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["bullmq", "ioredis"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // No other site may embed Embark. Document previews set their own same-origin rule instead.
      { source: "/((?!api/documents/[^/]+/download).*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
    ];
  },
};

export default nextConfig;
