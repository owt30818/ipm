import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { canDelete, canManage } from "@/lib/roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeKst } from "@/lib/utils";
import { ErrorNotice } from "@/components/ui/error-notice";
import { CopyIpButton } from "@/components/ip/copy-ip-button";
import { toKoreanError } from "@/lib/errors";
import { IpAddressTable } from "../dashboard/ip-address-table";
import { IpAddressList } from "../dashboard/ip-address-list";
import { PaginationControl } from "@/components/pagination-control";
import { SearchFilters } from "../dashboard/search-filters";
import { ExportButton } from "../dashboard/export-button";

async function getSubnets() {
    const supabase = await createClient();
    const { data } = await supabase
        .from("subnets")
        .select("id, name, cidr")
        .order("name");
    return data ?? [];
}

interface RecentIssuedIp {
    id: string;
    ip_address: string;
    allocated_to: string | null;
    allocated_at: string | null;
    created_at: string;
    subnet: { name: string; cidr: string } | null;
}

// 최근 발급(상태가 "할당됨")된 IP. allocated_at은 할당 대상을 입력했을 때만 채워지므로
// 값이 없는 행은 등록 시각(created_at)을 발급 시각으로 보고 두 결과를 합쳐 정렬한다.
async function getRecentIssuedIps(limit = 5) {
    const supabase = await createClient();
    const columns = "id, ip_address, allocated_to, allocated_at, created_at, subnet:subnets(name, cidr)";

    const [withDate, withoutDate] = await Promise.all([
        supabase
            .from("ip_addresses")
            .select(columns)
            .eq("status", "allocated")
            .not("allocated_at", "is", null)
            .order("allocated_at", { ascending: false })
            .limit(limit),
        supabase
            .from("ip_addresses")
            .select(columns)
            .eq("status", "allocated")
            .is("allocated_at", null)
            .order("created_at", { ascending: false })
            .limit(limit),
    ]);

    const failure = withDate.error ?? withoutDate.error;
    if (failure) {
        console.error("Error fetching recent IPs:", failure);
        return { items: [], error: toKoreanError(failure) };
    }

    const rows = [...(withDate.data ?? []), ...(withoutDate.data ?? [])] as unknown as RecentIssuedIp[];

    const items = rows
        .map((row) => ({ ...row, issuedAt: row.allocated_at ?? row.created_at }))
        .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
        .slice(0, limit);

    return { items, error: null };
}

interface FilterParams {
    status?: string;
    subnetId?: string;
    description?: string;
    ipAddress?: string;
    page?: number;
    limit?: number;
}

async function getIpAddresses(filters: FilterParams) {
    const { status, subnetId, description, ipAddress, page = 1, limit = 50 } = filters;
    const supabase = await createClient();
    const offset = (page - 1) * limit;

    // RPC 함수 사용 (IP 주소 텍스트 검색 지원)
    const { data, error } = await supabase.rpc("search_ip_addresses", {
        p_status: status || null,
        p_subnet_id: subnetId || null,
        p_description: description || null,
        p_ip_address: ipAddress || null,
        p_limit: limit,
        p_offset: offset,
    });

    if (error) {
        console.error("Error fetching IP addresses:", error);
        return { data: [], count: 0, error: toKoreanError(error) };
    }

    // RPC 결과를 기존 형식으로 변환
    const count = data?.[0]?.total_count ?? 0;
    const formattedData = (data ?? []).map((row: {
        id: string;
        subnet_id: string;
        ip_address: string;
        status: string;
        description: string | null;
        allocated_to: string | null;
        allocated_at: string | null;
        created_at: string;
        updated_at: string;
        subnet_cidr: string;
        subnet_name: string;
    }) => ({
        id: row.id,
        subnet_id: row.subnet_id,
        ip_address: row.ip_address,
        status: row.status,
        description: row.description,
        allocated_to: row.allocated_to,
        allocated_at: row.allocated_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        subnet: {
            id: row.subnet_id,
            cidr: row.subnet_cidr,
            name: row.subnet_name,
        },
    }));

    return { data: formattedData, count: Number(count), error: null };
}

export default async function IpListPage({
    searchParams,
}: {
    searchParams: Promise<{
        status?: string;
        subnet?: string;
        description?: string;
        ip?: string;
        page?: string;
        limit?: string;
    }>;
}) {
    const resolvedSearchParams = await searchParams;
    const status = resolvedSearchParams.status;
    const subnetId = resolvedSearchParams.subnet;
    const description = resolvedSearchParams.description;
    const ipAddress = resolvedSearchParams.ip;
    // page-size options in the UI go up to 100; never trust larger values from the URL
    const page = Math.max(1, Math.floor(Number(resolvedSearchParams.page)) || 1);
    const limit = Math.min(100, Math.max(1, Math.floor(Number(resolvedSearchParams.limit)) || 50));

    const session = await getSessionProfile();
    const canEdit = canManage(session?.role);
    const canRemove = canDelete(session?.role);

    const [subnets, { data: ipAddresses, count, error: listError }, { items: recentIps, error: recentError }] = await Promise.all([
        getSubnets(),
        getIpAddresses({ status, subnetId, description, ipAddress, page, limit }),
        getRecentIssuedIps(5),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">IP 목록</h1>
                <p className="text-muted-foreground">IP 주소를 검색하고 관리하세요</p>
            </div>

            {/* Recently issued IPs */}
            <Card>
                <CardHeader>
                    <CardTitle>최근 발급된 IP</CardTitle>
                    <CardDescription>가장 최근에 할당된 IP 5개</CardDescription>
                </CardHeader>
                <CardContent>
                    {recentError ? (
                        <ErrorNotice title="최근 발급된 IP를 불러오지 못했습니다" message={recentError} />
                    ) : recentIps.length === 0 ? (
                        <p className="text-sm text-muted-foreground">발급된 IP가 없습니다.</p>
                    ) : (
                        <ul className="divide-y">
                            {recentIps.map((ip) => (
                                <li
                                    key={ip.id}
                                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="font-mono font-medium">{ip.ip_address}</span>
                                        <CopyIpButton ip={ip.ip_address} className="-ml-2" />
                                        <Badge variant="secondary" className="truncate">
                                            {ip.subnet?.name ?? "-"}
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                        <span>{ip.allocated_to || "할당 대상 없음"}</span>
                                        <time dateTime={ip.issuedAt} className="font-mono">
                                            {formatDateTimeKst(ip.issuedAt)}
                                        </time>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {/* Search Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>IP 주소 검색</CardTitle>
                </CardHeader>
                <CardContent>
                    <SearchFilters subnets={subnets} />
                </CardContent>
            </Card>

            {/* IP Address List */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle>IP 주소 목록</CardTitle>
                    <ExportButton />
                </CardHeader>
                <CardContent className="space-y-4">
                    {listError ? (
                        <ErrorNotice title="IP 목록을 불러오지 못했습니다" message={listError} />
                    ) : (
                        <>
                            <Suspense fallback={<div>로딩 중...</div>}>
                                {/* Desktop: Table */}
                                <div className="hidden md:block">
                                    <IpAddressTable ipAddresses={ipAddresses} canEdit={canEdit} canDelete={canRemove} />
                                </div>
                                {/* Mobile: Card List */}
                                <div className="block md:hidden">
                                    <IpAddressList ipAddresses={ipAddresses} canEdit={canEdit} canDelete={canRemove} />
                                </div>
                            </Suspense>

                            <PaginationControl
                                total={count}
                                page={page}
                                limit={limit}
                            />
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
