import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Docker 이미지용 (web/Dockerfile)
  // 사내 도구: 모든 화면이 세션에 의존하므로 Cache Components(정적 셸)는 쓰지 않는다. docs/03_아키텍처.md §2
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
