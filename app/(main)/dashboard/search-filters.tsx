"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Subnet {
  id: string;
  name: string;
  cidr: string;
}

interface SearchFiltersProps {
  subnets: Subnet[];
}

export function SearchFilters({ subnets }: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") || "";
  const subnetId = searchParams.get("subnet") || "";
  const description = searchParams.get("description") || "";

  const updateFilters = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // 필터 변경 시 페이지를 1로 리셋
      params.delete("page");
      router.push(`/dashboard?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearFilters = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  const hasFilters = status || subnetId || description;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 상태 필터 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">상태</label>
          <Select value={status || "all"} onValueChange={(v) => updateFilters("status", v)}>
            <SelectTrigger>
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="available">사용 가능</SelectItem>
              <SelectItem value="allocated">할당됨</SelectItem>
              <SelectItem value="reserved">예약됨</SelectItem>
              <SelectItem value="deprecated">사용 안 함</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 서브넷 필터 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">서브넷</label>
          <Select value={subnetId || "all"} onValueChange={(v) => updateFilters("subnet", v)}>
            <SelectTrigger>
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {subnets.map((subnet) => (
                <SelectItem key={subnet.id} value={subnet.id}>
                  {subnet.name} ({subnet.cidr})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 설명 검색 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">설명 검색</label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              updateFilters("description", formData.get("description") as string);
            }}
          >
            <Input
              name="description"
              placeholder="설명 또는 할당 대상..."
              defaultValue={description}
            />
          </form>
        </div>

        {/* 초기화 버튼 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">&nbsp;</label>
          <Button
            variant="outline"
            className="w-full"
            onClick={clearFilters}
            disabled={!hasFilters}
          >
            필터 초기화
          </Button>
        </div>
      </div>

      {hasFilters && (
        <div className="text-sm text-muted-foreground">
          적용된 필터:
          {status && <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded">상태: {status}</span>}
          {subnetId && (
            <span className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900 rounded">
              서브넷: {subnets.find((s) => s.id === subnetId)?.name || subnetId}
            </span>
          )}
          {description && <span className="ml-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 rounded">설명: {description}</span>}
        </div>
      )}
    </div>
  );
}
