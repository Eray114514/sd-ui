import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma'],
  devIndicators: false,
};

export default nextConfig;
