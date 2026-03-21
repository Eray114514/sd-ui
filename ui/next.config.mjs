import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve("./"),
  serverExternalPackages: [],
};

export default nextConfig;
