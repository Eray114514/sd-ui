import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  // 使用 Babel 替代 SWC (解决权限问题)
  swcMinify: false,

  // 增加 API 路由超时时间
  experimental: {
    // 禁用服务器操作超时限制
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // 增加请求体大小限制 (通过 serverExternalPackages 或其他方式)
  serverExternalPackages: [],
};

export default nextConfig;
