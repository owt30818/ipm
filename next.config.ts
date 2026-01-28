import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "http://ypipm.taektech.com",
    "https://ypipm.taektech.com",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  typescript: {
    // 타입 에러는 개발 중에 IDE에서 확인
    ignoreBuildErrors: true,
  },
  eslint: {
    // Lint 에러는 개발 중에 확인
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
