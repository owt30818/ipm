import { formatDateTimeKst } from "@/lib/utils";

// Build metadata inlined by next.config.ts `env` at build time.
// Package list is intentionally not exposed here (server-only, see app/(main)/about/page.tsx).

export const buildInfo = {
  version: process.env.APP_VERSION || "0.0.0",
  buildTime: process.env.APP_BUILD_TIME || "",
  commit: process.env.APP_COMMIT || "",
};

export const formatBuildTime = formatDateTimeKst;

// "v0.1.0 · 2026-09-29"
export function shortVersionLabel(): string {
  const date = formatBuildTime(buildInfo.buildTime).split(" ")[0];
  return `v${buildInfo.version} · ${date}`;
}
