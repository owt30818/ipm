import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/error-notice";
import { Download } from "lucide-react";
import { buildInfo, formatBuildTime } from "@/lib/build-info";
import { getSessionProfile } from "@/lib/auth/session";
import { BACKUP_STALE_HOURS, formatBytes, listBackups, type BackupFile } from "@/lib/backups";
import { formatDateTimeKst } from "@/lib/utils";

const REPO_URL = "https://github.com/owt30818/ipm";

interface PackageInfo {
  name: string;
  range: string;
  version: string;
  type: "dependency" | "devDependency";
}

function getPackages(): PackageInfo[] {
  try {
    return JSON.parse(process.env.APP_PACKAGES || "[]");
  } catch {
    return [];
  }
}

function PackageTable({ packages }: { packages: PackageInfo[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>패키지</TableHead>
            <TableHead>설치 버전</TableHead>
            <TableHead className="hidden sm:table-cell">요구 범위</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {packages.map((pkg) => (
            <TableRow key={pkg.name}>
              <TableCell className="font-mono text-sm">{pkg.name}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="font-mono">
                  {pkg.version || "-"}
                </Badge>
              </TableCell>
              <TableCell className="hidden sm:table-cell font-mono text-sm text-muted-foreground">
                {pkg.range}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type BackupState =
  | { kind: "ok"; files: BackupFile[] }
  | { kind: "not-mounted" }
  | { kind: "error" };

async function loadBackups(): Promise<BackupState> {
  try {
    return { kind: "ok", files: await listBackups() };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" ? { kind: "not-mounted" } : { kind: "error" };
  }
}

// Status for everyone; the file list and downloads only for admins (dumps contain password hashes)
function BackupCard({ state, isAdmin }: { state: BackupState; isAdmin: boolean }) {
  let body: React.ReactNode;

  if (state.kind === "not-mounted") {
    body = (
      <p className="text-sm text-muted-foreground">
        백업 폴더가 연결되어 있지 않습니다. (docker-compose의 db-backup 서비스와 /backups 마운트 필요)
      </p>
    );
  } else if (state.kind === "error") {
    body = (
      <ErrorNotice
        title="백업 목록을 불러오지 못했습니다"
        message="백업 폴더를 읽을 권한이 없습니다. 폴더 권한을 확인하세요."
      />
    );
  } else {
    const latest = state.files[0];
    const stale =
      !latest ||
      Date.now() - new Date(latest.createdAt).getTime() > BACKUP_STALE_HOURS * 60 * 60 * 1000;

    body = (
      <div className="space-y-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-muted-foreground">마지막 백업</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono">
                {latest ? `${formatDateTimeKst(latest.createdAt)} KST` : "-"}
              </span>
              {stale ? (
                <Badge variant="destructive">{latest ? "지연" : "없음"}</Badge>
              ) : (
                <Badge variant="secondary">정상</Badge>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">보관 중인 백업</dt>
            <dd className="font-mono">{state.files.length}개</dd>
          </div>
        </dl>
        {stale && (
          <p className="text-sm text-red-600 dark:text-red-400">
            최근 {BACKUP_STALE_HOURS}시간 동안 성공한 백업이 없습니다. db-backup 컨테이너 로그를 확인하세요.
          </p>
        )}
        {isAdmin && state.files.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>백업 일시 (KST)</TableHead>
                  <TableHead className="hidden sm:table-cell">파일</TableHead>
                  <TableHead>크기</TableHead>
                  <TableHead className="text-right">다운로드</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.files.map((file) => (
                  <TableRow key={file.name}>
                    <TableCell className="font-mono text-sm">
                      {formatDateTimeKst(file.createdAt)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-sm text-muted-foreground">
                      {file.name}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{formatBytes(file.size)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <a href={`/api/backups/${file.name}`} download={file.name}>
                          <Download className="h-4 w-4" />
                          <span className="sr-only sm:not-sr-only sm:ml-1">받기</span>
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>DB 백업</CardTitle>
        <CardDescription>
          Supabase DB 일일 백업 (public + auth 스키마, pg_dump custom 포맷)
          {isAdmin && " · 복구 방법은 README 참고"}
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

export default async function AboutPage() {
  const [session, backups] = await Promise.all([getSessionProfile(), loadBackups()]);
  const packages = getPackages();
  const runtime = packages.filter((p) => p.type === "dependency");
  const dev = packages.filter((p) => p.type === "devDependency");
  const buildTime = formatBuildTime(buildInfo.buildTime);
  const shortCommit = buildInfo.commit.slice(0, 7);

  const info = [
    { label: "버전", value: `v${buildInfo.version} (${buildTime.split(" ")[0]})` },
    { label: "빌드 일시", value: `${buildTime} KST` },
    { label: "Node.js", value: process.version },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">정보</h1>
        <p className="text-muted-foreground">애플리케이션 버전과 설치된 패키지를 확인하세요</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>IPAM - IP Address Management</CardTitle>
          <CardDescription>현재 실행 중인 빌드 정보</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {info.map((item) => (
              <div key={item.label}>
                <dt className="text-sm text-muted-foreground">{item.label}</dt>
                <dd className="font-mono">{item.value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-sm text-muted-foreground">커밋</dt>
              <dd className="font-mono">
                {shortCommit ? (
                  <a
                    href={`${REPO_URL}/commit/${buildInfo.commit}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {shortCommit}
                  </a>
                ) : (
                  "-"
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <BackupCard state={backups} isAdmin={session?.role === "admin"} />

      <Card>
        <CardHeader>
          <CardTitle>런타임 패키지</CardTitle>
          <CardDescription>dependencies · {runtime.length}개</CardDescription>
        </CardHeader>
        <CardContent>
          <PackageTable packages={runtime} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>개발 도구</CardTitle>
          <CardDescription>devDependencies · {dev.length}개</CardDescription>
        </CardHeader>
        <CardContent>
          <PackageTable packages={dev} />
        </CardContent>
      </Card>
    </div>
  );
}
