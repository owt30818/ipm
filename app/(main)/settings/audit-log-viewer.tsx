"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuditLog } from "@/lib/types/database";

const actionLabels = {
  create: { label: "생성", className: "bg-green-100 text-green-800" },
  update: { label: "수정", className: "bg-blue-100 text-blue-800" },
  delete: { label: "삭제", className: "bg-red-100 text-red-800" },
  allocate: { label: "할당", className: "bg-purple-100 text-purple-800" },
  release: { label: "해제", className: "bg-gray-100 text-gray-800" },
};

interface AuditLogWithDetails extends AuditLog {
  user?: { id: string; email: string } | null;
  ip_address?: { id: string; ip_address: string } | null;
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchLogs();
  }, [limit]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/audit-logs?limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        감사 로그가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {logs.map((log) => {
          const actionConfig = actionLabels[log.action_type] || {
            label: log.action_type,
            className: "bg-gray-100 text-gray-800",
          };

          return (
            <div
              key={log.id}
              className="border rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge className={actionConfig.className}>
                    {actionConfig.label}
                  </Badge>
                  {log.ip_address && (
                    <span className="font-mono text-sm">
                      {log.ip_address.ip_address}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString("ko-KR")}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {log.user?.email || "시스템"}
              </div>
              {log.action_type === "update" && log.old_value && log.new_value && (
                <div className="mt-2 text-xs space-y-1 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <ChangeDetail
                    label="상태"
                    oldValue={(log.old_value as Record<string, unknown>).status as string}
                    newValue={(log.new_value as Record<string, unknown>).status as string}
                  />
                  <ChangeDetail
                    label="할당 대상"
                    oldValue={(log.old_value as Record<string, unknown>).allocated_to as string}
                    newValue={(log.new_value as Record<string, unknown>).allocated_to as string}
                  />
                  <ChangeDetail
                    label="설명"
                    oldValue={(log.old_value as Record<string, unknown>).description as string}
                    newValue={(log.new_value as Record<string, unknown>).description as string}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {logs.length >= limit && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setLimit((prev) => prev + 50)}
        >
          더 보기
        </Button>
      )}
    </div>
  );
}

function ChangeDetail({
  label,
  oldValue,
  newValue,
}: {
  label: string;
  oldValue?: string | null;
  newValue?: string | null;
}) {
  if (oldValue === newValue) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      <span className="text-muted-foreground">{label}:</span>
      <span className="line-through text-red-500">{oldValue || "(없음)"}</span>
      <span>→</span>
      <span className="text-green-600">{newValue || "(없음)"}</span>
    </div>
  );
}
