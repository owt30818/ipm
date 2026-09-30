import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { canDelete, canManage } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNotice } from "@/components/ui/error-notice";
import { toKoreanError } from "@/lib/errors";
import { parseIpSort, type IpSort } from "@/lib/ip-sort";
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

interface FilterParams {
    status?: string;
    subnetId?: string;
    description?: string;
    ipAddress?: string;
    page?: number;
    limit?: number;
    sort?: IpSort;
}

async function getIpAddresses(filters: FilterParams) {
    const { status, subnetId, description, ipAddress, page = 1, limit = 50, sort } = filters;
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
        p_sort: sort,
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
        sort?: string;
    }>;
}) {
    const resolvedSearchParams = await searchParams;
    const status = resolvedSearchParams.status;
    const subnetId = resolvedSearchParams.subnet;
    const description = resolvedSearchParams.description;
    const ipAddress = resolvedSearchParams.ip;
    const sort = parseIpSort(resolvedSearchParams.sort);
    // page-size options in the UI go up to 100; never trust larger values from the URL
    const page = Math.max(1, Math.floor(Number(resolvedSearchParams.page)) || 1);
    const limit = Math.min(100, Math.max(1, Math.floor(Number(resolvedSearchParams.limit)) || 50));

    const session = await getSessionProfile();
    const canEdit = canManage(session?.role);
    const canRemove = canDelete(session?.role);

    const [subnets, { data: ipAddresses, count, error: listError }] = await Promise.all([
        getSubnets(),
        getIpAddresses({ status, subnetId, description, ipAddress, page, limit, sort }),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">IP 목록</h1>
                <p className="text-muted-foreground">IP 주소를 검색하고 관리하세요</p>
            </div>

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
