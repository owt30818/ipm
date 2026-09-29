import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SubnetStats {
  id: string;
  name: string;
  cidr: string;
  totalCapacity: number;  // 사용 가능한 호스트 수 (네트워크/브로드캐스트 제외)
  registered: number;     // 등록된 IP 수
  available: number;      // available 상태
  allocated: number;      // allocated 상태
  reserved: number;       // reserved 상태
  deprecated: number;     // deprecated 상태
  unregistered: number;   // 아직 등록되지 않은 호스트 수
}

interface SubnetStatsRow {
  id: string;
  name: string;
  cidr: string;
  total_capacity: number;
  registered: number;
  available: number;
  allocated: number;
  reserved: number;
  deprecated: number;
}

async function getSubnetStats(): Promise<SubnetStats[]> {
  const supabase = await createClient();

  // 서브넷별 집계를 DB에서 한 번에 계산 (get_subnet_stats)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (supabase.rpc as any)("get_subnet_stats")) as {
    data: SubnetStatsRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("Error fetching subnet stats:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    cidr: row.cidr,
    totalCapacity: row.total_capacity,
    registered: row.registered,
    available: row.available,
    allocated: row.allocated,
    reserved: row.reserved,
    deprecated: row.deprecated,
    unregistered: Math.max(row.total_capacity - row.registered, 0),
  }));
}

export default async function DashboardPage() {
  const subnetStats = await getSubnetStats();

  // 전체 합계 계산
  const totals = subnetStats.reduce(
    (acc, s) => ({
      total: acc.total + s.totalCapacity,
      available: acc.available + s.available,
      allocated: acc.allocated + s.allocated,
      reserved: acc.reserved + s.reserved,
      unregistered: acc.unregistered + s.unregistered,
    }),
    { total: 0, available: 0, allocated: 0, reserved: 0, unregistered: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">대시보드</h1>
        <p className="text-muted-foreground">IP 주소 현황을 확인하세요</p>
      </div>

      {/* 전체 통계 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              전체 IP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              사용 가능
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{totals.available}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              할당됨
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{totals.allocated}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              예약됨
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{totals.reserved}</p>
          </CardContent>
        </Card>
      </div>

      {/* 서브넷별 상세 통계 */}
      {subnetStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>서브넷별 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">서브넷</th>
                    <th className="text-right py-3 px-2 font-medium">전체</th>
                    <th className="text-right py-3 px-2 font-medium">
                      <span className="text-green-600">사용 가능</span>
                    </th>
                    <th className="text-right py-3 px-2 font-medium">
                      <span className="text-blue-600">할당됨</span>
                    </th>
                    <th className="text-right py-3 px-2 font-medium">
                      <span className="text-yellow-600">예약됨</span>
                    </th>
                    <th className="text-right py-3 px-2 font-medium">
                      <span className="text-gray-500">미등록</span>
                    </th>
                    <th className="text-right py-3 px-2 font-medium">사용률</th>
                  </tr>
                </thead>
                <tbody>
                  {subnetStats.map((subnet) => {
                    const usageRate = subnet.totalCapacity > 0
                      ? Math.round(((subnet.allocated + subnet.reserved) / subnet.totalCapacity) * 100)
                      : 0;
                    return (
                      <tr key={subnet.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium">{subnet.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{subnet.cidr}</p>
                          </div>
                        </td>
                        <td className="text-right py-3 px-2 font-mono">{subnet.totalCapacity}</td>
                        <td className="text-right py-3 px-2 font-mono text-green-600">{subnet.available}</td>
                        <td className="text-right py-3 px-2 font-mono text-blue-600">{subnet.allocated}</td>
                        <td className="text-right py-3 px-2 font-mono text-yellow-600">{subnet.reserved}</td>
                        <td className="text-right py-3 px-2 font-mono text-gray-500">{subnet.unregistered}</td>
                        <td className="text-right py-3 px-2">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${usageRate >= 90 ? "bg-red-500" :
                                    usageRate >= 70 ? "bg-yellow-500" :
                                      "bg-green-500"
                                  }`}
                                style={{ width: `${usageRate}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium w-10 text-right">{usageRate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-800 font-medium">
                    <td className="py-3 px-2">합계</td>
                    <td className="text-right py-3 px-2 font-mono">{totals.total}</td>
                    <td className="text-right py-3 px-2 font-mono text-green-600">{totals.available}</td>
                    <td className="text-right py-3 px-2 font-mono text-blue-600">{totals.allocated}</td>
                    <td className="text-right py-3 px-2 font-mono text-yellow-600">{totals.reserved}</td>
                    <td className="text-right py-3 px-2 font-mono text-gray-500">{totals.unregistered}</td>
                    <td className="text-right py-3 px-2">
                      <span className="text-xs font-medium">
                        {totals.total > 0
                          ? Math.round(((totals.allocated + totals.reserved) / totals.total) * 100)
                          : 0}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

