import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve("./"),
  serverExternalPackages: [],
  devIndicators: false,
};

export default nextConfig;
