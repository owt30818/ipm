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
import { buildInfo, formatBuildTime } from "@/lib/build-info";
import { getSessionProfile } from "@/lib/auth/session";
import { getKeepAliveStatus } from "@/lib/keep-alive";
import { formatDateTimeKst } from "@/lib/utils";
import { BackupDownloads } from "./backup-downloads";

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

// Admin only: CSV backups of the main tables + the daily keep-alive status (lib/keep-alive.ts)
function BackupCard() {
  const { lastSuccessAt, lastFailureAt } = getKeepAliveStatus();
  const failing = !!lastFailureAt && (!lastSuccessAt || lastFailureAt > lastSuccessAt);

  return (
    <Card>
      <CardHeader>
        <CardTitle>DB 백업</CardTitle>
        <CardDescription>
          현재 데이터를 CSV로 내려받습니다. IP 주소 CSV는 서브넷을 만든 뒤 IP 할당 → CSV 업로드로 다시 등록할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <BackupDownloads />
        <div>
          <p className="text-sm text-muted-foreground">마지막 DB 접속 확인 (무료 티어 일시 중지 방지, 매일 자동)</p>
          <p className="flex items-center gap-2">
            <span className="font-mono">
              {lastSuccessAt ? `${formatDateTimeKst(lastSuccessAt)} KST` : "아직 없음 (서버 시작 1분 후 첫 확인)"}
            </span>
            {failing && <Badge variant="destructive">실패</Badge>}
          </p>
          {failing && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {formatDateTimeKst(lastFailureAt)} KST 접속에 실패했습니다. 앱 컨테이너 로그를 확인하세요.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AboutPage() {
  const session = await getSessionProfile();
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

      {session?.role === "admin" && <BackupCard />}

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
