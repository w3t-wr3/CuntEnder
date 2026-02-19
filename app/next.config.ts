import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Needed for @solana/wallet-adapter
    config.externals.push("pino-pretty", "encoding");
    return config;
  },
};

export default nextConfig;
