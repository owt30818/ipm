// Build metadata inlined by next.config.ts `env` at build time.
// Package list is intentionally not exposed here (server-only, see app/(main)/about/page.tsx).

export const buildInfo = {
  version: process.env.APP_VERSION || "0.0.0",
  buildTime: process.env.APP_BUILD_TIME || "",
  commit: process.env.APP_COMMIT || "",
};

// "2026-09-29 15:01" in KST
export function formatBuildTime(iso: string): string {
  if (!iso) return "-";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

// "v0.1.0 · 2026-09-29"
export function shortVersionLabel(): string {
  const date = formatBuildTime(buildInfo.buildTime).split(" ")[0];
  return `v${buildInfo.version} · ${date}`;
}
