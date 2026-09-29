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

export default function AboutPage() {
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
