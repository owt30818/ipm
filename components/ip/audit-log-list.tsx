"use client";

import { AuditLog } from "@/lib/types/database";

const actionLabels = {
  create: "생성",
  update: "수정",
  delete: "삭제",
  allocate: "할당",
  release: "해제",
};

interface AuditLogWithUser extends AuditLog {
  user?: { id: string; email: string } | null;
}

interface AuditLogListProps {
  logs: AuditLogWithUser[];
}

export function AuditLogList({ logs }: AuditLogListProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        변경 이력이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[300px] overflow-y-auto">
      {logs.map((log) => (
        <div
          key={log.id}
          className="border rounded-lg p-3 text-sm space-y-1"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {actionLabels[log.action_type] || log.action_type}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(log.created_at).toLocaleString("ko-KR")}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {log.user?.email || "시스템"}
          </div>
          {log.action_type === "update" && log.old_value && log.new_value && (
            <div className="mt-2 text-xs space-y-1">
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
      ))}
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
    <div className="flex gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className="line-through text-red-500">{oldValue || "(없음)"}</span>
      <span>→</span>
      <span className="text-green-600">{newValue || "(없음)"}</span>
    </div>
  );
}
