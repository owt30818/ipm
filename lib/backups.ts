import { readdir, stat } from "node:fs/promises";
import path from "node:path";

// DB dumps written by the db-backup service (docker-compose.yml), mounted read-only into the app.
// Server-only: dumps contain auth.users password hashes, so downloads are admin-only.

export const BACKUP_DIR = process.env.BACKUP_MOUNT_DIR || "/backups";

// Same name the db-backup script writes: ipam-YYYYMMDD-HHMMSSZ.dump (UTC)
const BACKUP_NAME = /^ipam-\d{8}-\d{6}Z\.dump$/;

// No backup within this window is shown as a warning (the default interval is 24h)
export const BACKUP_STALE_HOURS = 48;

export interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

export function isBackupName(name: string): boolean {
  return BACKUP_NAME.test(name);
}

export function backupPath(name: string): string {
  return path.join(BACKUP_DIR, name);
}

// Newest first. Throws when the directory is missing or unreadable (not mounted).
export async function listBackups(): Promise<BackupFile[]> {
  const names = (await readdir(BACKUP_DIR)).filter(isBackupName);
  const files = await Promise.all(
    names.map(async (name) => {
      const info = await stat(backupPath(name));
      return { name, size: info.size, createdAt: info.mtime.toISOString() };
    })
  );
  return files.sort((a, b) => b.name.localeCompare(a.name));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
