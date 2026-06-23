import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the mock agent (or Jake's real Hermes instance) to run on a separate port
  // and be called from server-side API routes without CORS issues.
  experimental: {},
};

export default nextConfig;