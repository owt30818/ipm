"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Bookmark, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  MAX_SAVED_NAME_LENGTH,
  MAX_SAVED_SEARCHES,
  SAVED_SEARCHES_KEY,
  applySavedSearch,
  defaultSearchName,
  describeFilters,
  hasSavedName,
  hasSearchFilter,
  loadSavedSearches,
  pickFilters,
  removeSavedSearch,
  sameFilters,
  storeSavedSearches,
  upsertSavedSearch,
  type SavedSearch,
} from "@/lib/saved-searches";

interface SavedSearchesProps {
  subnets: { id: string; name: string }[];
}

// One-click chips for the searches used often ("acp", "proxmox", ...). Saved in this browser.
export function SavedSearches({ subnets }: SavedSearchesProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // null until localStorage has been read, so server and first client render match
  const [saved, setSaved] = useState<SavedSearch[] | null>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setSaved(loadSavedSearches());
    // keep other tabs in sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === SAVED_SEARCHES_KEY) setSaved(loadSavedSearches());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const current = useMemo(() => pickFilters((key) => searchParams.get(key)), [searchParams]);
  const canSave = hasSearchFilter(current);

  if (saved === null) return null;

  const persist = (next: SavedSearch[]): boolean => {
    if (!storeSavedSearches(next)) {
      toast({
        title: "저장하지 못했습니다",
        description: "브라우저가 저장 공간 사용을 막고 있습니다. 시크릿 모드인지 확인해 주세요.",
        variant: "destructive",
      });
      return false;
    }
    setSaved(next);
    return true;
  };

  const startNaming = () => {
    setName(defaultSearchName(current, subnets));
    setNaming(true);
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!hasSavedName(saved, trimmed) && saved.length >= MAX_SAVED_SEARCHES) {
      toast({
        title: "더 저장할 수 없습니다",
        description: `저장된 검색은 최대 ${MAX_SAVED_SEARCHES}개입니다. 안 쓰는 검색을 지워 주세요.`,
        variant: "destructive",
      });
      return;
    }
    if (persist(upsertSavedSearch(saved, trimmed, current))) setNaming(false);
  };

  const open = (search: SavedSearch) => {
    const query = applySavedSearch(searchParams, search.filters).toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-sm font-medium">
        <Bookmark className="h-4 w-4" />
        자주 쓰는 검색
      </span>

      {saved.length === 0 && !naming && (
        <span className="text-sm text-muted-foreground">
          검색 조건을 적용한 뒤 &lsquo;현재 검색 저장&rsquo;을 누르면 여기에 저장됩니다.
        </span>
      )}

      {saved.map((search) => {
        const active = sameFilters(search.filters, current);
        return (
          <div
            key={search.id}
            className={cn(
              "inline-flex items-center rounded-full border text-sm",
              active ? "border-primary bg-primary/10" : "bg-background"
            )}
          >
            <button
              type="button"
              aria-pressed={active}
              title={describeFilters(search.filters, subnets)}
              onClick={() => open(search)}
              className="rounded-l-full py-1.5 pl-3 pr-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {search.name}
            </button>
            <button
              type="button"
              aria-label={`${search.name} 삭제`}
              title="삭제"
              onClick={() => persist(removeSavedSearch(saved, search.id))}
              className="rounded-r-full py-1.5 pl-1 pr-2.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      {naming ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <Input
            autoFocus
            value={name}
            maxLength={MAX_SAVED_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setNaming(false);
            }}
            aria-label="저장할 검색 이름"
            placeholder="검색 이름"
            className="h-8 w-40"
          />
          <Button type="submit" size="sm" disabled={!name.trim()}>
            저장
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setNaming(false)}>
            취소
          </Button>
        </form>
      ) : (
        canSave && (
          <Button type="button" size="sm" variant="outline" onClick={startNaming}>
            <Plus />
            현재 검색 저장
          </Button>
        )
      )}
    </div>
  );
}
