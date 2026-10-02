import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/session";
import { backupPath, isBackupName } from "@/lib/backups";

// Admin-only download of a DB dump (contains auth.users password hashes)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await getSessionProfile();

  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "관리자만 백업을 다운로드할 수 있습니다." }, { status: 403 });
  }

  // The strict name pattern also rules out path traversal
  const { name } = await params;
  if (!isBackupName(name)) {
    return NextResponse.json({ error: "유효하지 않은 백업 파일입니다." }, { status: 400 });
  }

  const filePath = backupPath(name);
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return NextResponse.json({ error: "백업 파일을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
