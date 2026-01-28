import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SubnetStats {
  id: string;
  name: string;
  cidr: string;
  totalCapacity: number;  // CIDR 기반 전체 IP 수
  registered: number;     // 등록된 IP 수
  available: number;      // available 상태
  allocated: number;      // allocated 상태
  reserved: number;       // reserved 상태
  deprecated: number;     // deprecated 상태
  unregistered: number;   // 미등록 IP 수
}

// CIDR에서 호스트 IP 수 계산 (네트워크/브로드캐스트 포함)
function calculateIpCount(cidr: string): number {
  const match = cidr.match(/\/(\d+)$/);
  if (!match) return 0;
  const prefix = parseInt(match[1], 10);
  // /32는 1개, /31은 2개, /30은 4개, ...
  return Math.pow(2, 32 - prefix);
}

async function getSubnetStats(): Promise<SubnetStats[]> {
  const supabase = await createClient();

  // 서브넷 목록 가져오기
  const { data: subnets } = await supabase
    .from("subnets")
    .select("id, name, cidr")
    .order("name");

  if (!subnets || subnets.length === 0) {
    return [];
  }

  // 각 서브넷별 통계 가져오기
  const statsPromises = subnets.map(async (subnet) => {
    const totalCapacity = calculateIpCount(subnet.cidr);

    const [registeredResult, availableResult, allocatedResult, reservedResult, deprecatedResult] = await Promise.all([
      supabase
        .from("ip_addresses")
        .select("*", { count: "exact", head: true })
        .eq("subnet_id", subnet.id),
      supabase
        .from("ip_addresses")
        .select("*", { count: "exact", head: true })
        .eq("subnet_id", subnet.id)
        .eq("status", "available"),
      supabase
        .from("ip_addresses")
        .select("*", { count: "exact", head: true })
        .eq("subnet_id", subnet.id)
        .eq("status", "allocated"),
      supabase
        .from("ip_addresses")
        .select("*", { count: "exact", head: true })
        .eq("subnet_id", subnet.id)
        .eq("status", "reserved"),
      supabase
        .from("ip_addresses")
        .select("*", { count: "exact", head: true })
        .eq("subnet_id", subnet.id)
        .eq("status", "deprecated"),
    ]);

    const registered = registeredResult.count ?? 0;

    return {
      id: subnet.id,
      name: subnet.name,
      cidr: subnet.cidr,
      totalCapacity,
      registered,
      available: availableResult.count ?? 0,
      allocated: allocatedResult.count ?? 0,
      reserved: reservedResult.count ?? 0,
      deprecated: deprecatedResult.count ?? 0,
      unregistered: totalCapacity - registered,
    };
  });

  return Promise.all(statsPromises);
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
    }),
    { total: 0, available: 0, allocated: 0, reserved: 0 }
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

