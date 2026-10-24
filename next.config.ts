import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local preview hosts (computer-use / cloud agent browsers)
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
