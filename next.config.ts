import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Build metadata for the /about page (inlined at build time, not runtime config)
function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function getCommit(): string {
  if (process.env.GIT_SHA) return process.env.GIT_SHA;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

function getPackages() {
  const pkg = readJson("package.json");
  const lock = readJson("package-lock.json");
  const groups = [
    ["dependency", pkg.dependencies],
    ["devDependency", pkg.devDependencies],
  ] as const;

  return groups
    .flatMap(([type, deps]) =>
      Object.entries((deps ?? {}) as Record<string, string>).map(([name, range]) => ({
        name,
        range,
        version: lock.packages?.[`node_modules/${name}`]?.version ?? "",
        type,
      }))
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    APP_VERSION: readJson("package.json").version,
    APP_BUILD_TIME: new Date().toISOString(),
    APP_COMMIT: getCommit(),
    APP_PACKAGES: JSON.stringify(getPackages()),
  },
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
