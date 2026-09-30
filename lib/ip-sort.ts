// Sort options of the IP list (search_ip_addresses p_sort, migration 012).
// "Issued" time = allocated_at, or created_at when the IP has no allocation time.

export const IP_SORTS = ["ip_asc", "issued_desc", "issued_asc"] as const;

export type IpSort = (typeof IP_SORTS)[number];

export const DEFAULT_IP_SORT: IpSort = "ip_asc";

export const IP_SORT_LABELS: Record<IpSort, string> = {
  ip_asc: "IP 주소순",
  issued_desc: "최신 발급순",
  issued_asc: "오래된 발급순",
};

export function parseIpSort(value: string | null | undefined): IpSort {
  return (IP_SORTS as readonly string[]).includes(value ?? "") ? (value as IpSort) : DEFAULT_IP_SORT;
}
