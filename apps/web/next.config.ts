import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@go-fish/contracts", "@go-fish/ui"],
};

export default nextConfig;

