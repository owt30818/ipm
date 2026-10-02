"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2 } from "lucide-react";

const ITEMS = [
  { table: "subnets", label: "서브넷" },
  { table: "ip-addresses", label: "IP 주소" },
  { table: "audit-logs", label: "감사 로그" },
] as const;

// fetch + blob (not a plain link) so a failed export shows a toast instead of downloading the error JSON
export function BackupDownloads() {
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const download = async (table: string, label: string) => {
    setLoading(table);
    try {
      const res = await fetch(`/api/backups/${table}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast({
          title: "백업 실패",
          description: body?.error || "백업 파일을 만들지 못했습니다.",
          variant: "destructive",
        });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ipam-${table}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "백업 완료",
        description: `${label} ${res.headers.get("X-Row-Count") ?? ""}건을 CSV로 저장했습니다.`,
      });
    } catch {
      toast({
        title: "백업 실패",
        description: "서버에 연결할 수 없습니다. 네트워크를 확인하세요.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {ITEMS.map(({ table, label }) => (
        <Button
          key={table}
          variant="outline"
          onClick={() => download(table, label)}
          disabled={loading !== null}
        >
          {loading === table ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {label} CSV
        </Button>
      ))}
    </div>
  );
}
