// Frequently used IP-list searches ("acp", "proxmox", ...) kept in this browser's localStorage.
// They belong to the browser, not the account. To sync them across devices later, replace
// loadSavedSearches / storeSavedSearches (and keep the rest) with a DB-backed version.

import { DEFAULT_IP_SORT, IP_SORT_LABELS, parseIpSort } from "@/lib/ip-sort";

// URL query params that make up a search (page / limit are not part of it)
export const SEARCH_FILTER_KEYS = ["status", "subnet", "description", "ip", "sort"] as const;

export type SearchFilterKey = (typeof SEARCH_FILTER_KEYS)[number];
export type SearchFilterValues = Partial<Record<SearchFilterKey, string>>;

export interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilterValues;
}

export const SAVED_SEARCHES_KEY = "ipm:saved-searches:v1";
export const MAX_SAVED_SEARCHES = 20;
export const MAX_SAVED_NAME_LENGTH = 30;

const STATUS_LABELS: Record<string, string> = {
  available: "사용 가능",
  allocated: "할당됨",
  reserved: "예약됨",
  deprecated: "사용 안 함",
};

// Reads the five filter params through `get`, dropping empty values and the default sort,
// so two searches that look the same compare equal.
export function pickFilters(
  get: (key: SearchFilterKey) => string | null | undefined
): SearchFilterValues {
  const filters: SearchFilterValues = {};
  for (const key of SEARCH_FILTER_KEYS) {
    const value = (get(key) ?? "").trim();
    if (!value) continue;
    if (key === "sort") {
      const sort = parseIpSort(value);
      if (sort !== DEFAULT_IP_SORT) filters.sort = sort;
      continue;
    }
    filters[key] = value;
  }
  return filters;
}

// A sort-only "search" is not worth saving; it needs at least one real filter.
export function hasSearchFilter(filters: SearchFilterValues): boolean {
  return Boolean(filters.status || filters.subnet || filters.description || filters.ip);
}

export function sameFilters(a: SearchFilterValues, b: SearchFilterValues): boolean {
  return SEARCH_FILTER_KEYS.every((key) => (a[key] ?? "") === (b[key] ?? ""));
}

// Params for opening a saved search: replaces the five filters, keeps everything else
// (e.g. the chosen page size) and goes back to page 1.
export function applySavedSearch(
  current: URLSearchParams,
  filters: SearchFilterValues
): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  for (const key of SEARCH_FILTER_KEYS) {
    params.delete(key);
    const value = filters[key];
    if (value) params.set(key, value);
  }
  params.delete("page");
  return params;
}

type SubnetLabel = { id: string; name: string };

// "설명: proxmox · 서브넷: lab · 상태: 할당됨" (tooltip of a saved search)
export function describeFilters(filters: SearchFilterValues, subnets: SubnetLabel[]): string {
  const parts: string[] = [];
  if (filters.description) parts.push(`설명: ${filters.description}`);
  if (filters.ip) parts.push(`IP: ${filters.ip}`);
  if (filters.subnet) {
    parts.push(`서브넷: ${subnets.find((s) => s.id === filters.subnet)?.name ?? "삭제된 서브넷"}`);
  }
  if (filters.status) parts.push(`상태: ${STATUS_LABELS[filters.status] ?? filters.status}`);
  if (filters.sort) parts.push(`정렬: ${IP_SORT_LABELS[parseIpSort(filters.sort)]}`);
  return parts.join(" · ");
}

// Suggested name when saving: the search text if there is one, otherwise the subnet / status
export function defaultSearchName(filters: SearchFilterValues, subnets: SubnetLabel[]): string {
  const name =
    filters.description ||
    filters.ip ||
    subnets.find((s) => s.id === filters.subnet)?.name ||
    (filters.status ? STATUS_LABELS[filters.status] ?? filters.status : "");
  return name.slice(0, MAX_SAVED_NAME_LENGTH);
}

export function hasSavedName(list: SavedSearch[], name: string): boolean {
  const wanted = name.trim().toLowerCase();
  return list.some((s) => s.name.toLowerCase() === wanted);
}

// Adds a search; a saved search with the same name (case-insensitive) is overwritten in place.
export function upsertSavedSearch(
  list: SavedSearch[],
  name: string,
  filters: SearchFilterValues
): SavedSearch[] {
  const trimmed = name.trim().slice(0, MAX_SAVED_NAME_LENGTH);
  const wanted = trimmed.toLowerCase();
  const existing = list.find((s) => s.name.toLowerCase() === wanted);
  if (existing) {
    return list.map((s) => (s === existing ? { ...s, name: trimmed, filters } : s));
  }
  // crypto.randomUUID needs a secure context, and the app is also reached over plain http on the LAN
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return [...list, { id, name: trimmed, filters }];
}

export function removeSavedSearch(list: SavedSearch[], id: string): SavedSearch[] {
  return list.filter((s) => s.id !== id);
}

// localStorage can throw (private window, blocked site data) and its content can be edited by
// hand or come from an older format, so everything read back is validated.
export function loadSavedSearches(): SavedSearch[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];

    const list: SavedSearch[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const { id, name, filters } = item as Record<string, unknown>;
      if (typeof id !== "string" || typeof name !== "string" || !name.trim()) continue;
      const raw = filters && typeof filters === "object" ? (filters as Record<string, unknown>) : {};
      const clean = pickFilters((key) => (typeof raw[key] === "string" ? (raw[key] as string) : null));
      if (!hasSearchFilter(clean)) continue;
      list.push({ id, name: name.slice(0, MAX_SAVED_NAME_LENGTH), filters: clean });
    }
    return list.slice(0, MAX_SAVED_SEARCHES);
  } catch {
    return [];
  }
}

// false when the browser refused to store it
export function storeSavedSearches(list: SavedSearch[]): boolean {
  try {
    localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}
