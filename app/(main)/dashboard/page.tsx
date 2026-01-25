import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IpAddressTable } from "./ip-address-table";
import { IpAddressList } from "./ip-address-list";
import { PaginationControl } from "@/components/pagination-control";

async function getStats() {
  const supabase = await createClient();

  const { count: totalCount } = await supabase
    .from("ip_addresses")
    .select("*", { count: "exact", head: true });

  const { count: availableCount } = await supabase
    .from("ip_addresses")
    .select("*", { count: "exact", head: true })
    .eq("status", "available");

  const { count: allocatedCount } = await supabase
    .from("ip_addresses")
    .select("*", { count: "exact", head: true })
    .eq("status", "allocated");

  const { count: reservedCount } = await supabase
    .from("ip_addresses")
    .select("*", { count: "exact", head: true })
    .eq("status", "reserved");

  return {
    total: totalCount ?? 0,
    available: availableCount ?? 0,
    allocated: allocatedCount ?? 0,
    reserved: reservedCount ?? 0,
  };
}

async function getIpAddresses(
  search?: string,
  page: number = 1,
  limit: number = 50
) {
  const supabase = await createClient();

  let query = supabase
    .from("ip_addresses")
    .select(
      `
      *,
      subnet:subnets(id, cidr, name)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `ip_address.ilike.%${search}%,description.ilike.%${search}%,allocated_to.ilike.%${search}%`
    );
  }

  // Pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching IP addresses:", error);
    return { data: [], count: 0 };
  }

  return { data: data ?? [], count: count ?? 0 };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; limit?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const search = resolvedSearchParams.search;
  const page = Number(resolvedSearchParams.page) || 1;
  const limit = Number(resolvedSearchParams.limit) || 50;

  const [stats, { data: ipAddresses, count }] = await Promise.all([
    getStats(),
    getIpAddresses(search, page, limit),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">대시보드</h1>
        <p className="text-muted-foreground">IP 주소 현황을 확인하세요</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              전체 IP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              사용 가능
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.available}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              할당됨
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{stats.allocated}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              예약됨
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{stats.reserved}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>IP 주소 검색</CardTitle>
        </CardHeader>
        <CardContent>
          <form>
            <Input
              name="search"
              placeholder="IP 주소, 설명, 할당 대상으로 검색..."
              defaultValue={search}
              className="max-w-md"
            />
            {/* hidden inputs to preserve pagination state if needed, or better, reset to page 1 on search */}
          </form>
        </CardContent>
      </Card>

      {/* IP Address List */}
      <Card>
        <CardHeader>
          <CardTitle>IP 주소 목록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={<div>로딩 중...</div>}>
            {/* Desktop: Table */}
            <div className="hidden md:block">
              <IpAddressTable ipAddresses={ipAddresses} />
            </div>
            {/* Mobile: Card List */}
            <div className="block md:hidden">
              <IpAddressList ipAddresses={ipAddresses} />
            </div>
          </Suspense>

          <PaginationControl
            total={count}
            page={page}
            limit={limit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
