"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { IpAddressWithSubnet, AuditLog } from "@/lib/types/database";
import { AuditLogList } from "./audit-log-list";
import { toKoreanError } from "@/lib/errors";

type IpStatus = "available" | "allocated" | "reserved" | "deprecated";

const statusConfig = {
  available: { label: "사용 가능", className: "bg-green-100 text-green-800" },
  allocated: { label: "할당됨", className: "bg-blue-100 text-blue-800" },
  reserved: { label: "예약됨", className: "bg-yellow-100 text-yellow-800" },
  deprecated: { label: "사용 안 함", className: "bg-gray-100 text-gray-800" },
};

interface IpDetailDialogProps {
  ip: IpAddressWithSubnet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function IpDetailDialog({
  ip,
  open,
  onOpenChange,
  canEdit = false,
  canDelete = false,
}: IpDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<IpStatus>("available");
  const [description, setDescription] = useState("");
  const [allocatedTo, setAllocatedTo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (ip) {
      setStatus(ip.status);
      setDescription(ip.description || "");
      setAllocatedTo(ip.allocated_to || "");
      fetchAuditLogs(ip.id);
    }
  }, [ip]);

  const fetchAuditLogs = async (ipId: string) => {
    try {
      const response = await fetch(`/api/audit-logs?ip_address_id=${ipId}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    }
  };

  const handleSave = async () => {
    if (!ip) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/ip-addresses/${ip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          description: description || null,
          allocated_to: allocatedTo || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "업데이트에 실패했습니다.");
      }

      toast({
        title: "수정 완료",
        description: "IP 정보가 업데이트되었습니다.",
      });

      setIsEditing(false);
      router.refresh();
      fetchAuditLogs(ip.id);
    } catch (error) {
      toast({
        title: "수정 실패",
        description: toKoreanError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!ip) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/ip-addresses/${ip.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "삭제에 실패했습니다.");
      }

      toast({
        title: "삭제 완료",
        description: "IP가 삭제되었습니다.",
      });

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast({
        title: "삭제 실패",
        description: toKoreanError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!ip) return null;

  const currentStatus = statusConfig[ip.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-xl">{ip.ip_address}</DialogTitle>
          <DialogDescription>
            {ip.subnet?.name} ({ip.subnet?.cidr})
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">상세 정보</TabsTrigger>
            <TabsTrigger value="audit">변경 이력</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            {isEditing ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">상태</label>
                  <Select
                    value={status}
                    onValueChange={(value) => setStatus(value as IpStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">사용 가능</SelectItem>
                      <SelectItem value="allocated">할당됨</SelectItem>
                      <SelectItem value="reserved">예약됨</SelectItem>
                      <SelectItem value="deprecated">사용 안 함</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">할당 대상</label>
                  <Input
                    value={allocatedTo}
                    onChange={(e) => setAllocatedTo(e.target.value)}
                    placeholder="서버명, 사용자 등"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">설명</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="IP 주소에 대한 설명"
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-20">상태:</span>
                  <Badge className={currentStatus.className}>
                    {currentStatus.label}
                  </Badge>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm text-muted-foreground w-20">할당 대상:</span>
                  <span className="text-sm">{ip.allocated_to || "-"}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm text-muted-foreground w-20">설명:</span>
                  <span className="text-sm">{ip.description || "-"}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm text-muted-foreground w-20">할당일:</span>
                  <span className="text-sm">
                    {ip.allocated_at
                      ? new Date(ip.allocated_at).toLocaleDateString("ko-KR")
                      : "-"}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm text-muted-foreground w-20">생성일:</span>
                  <span className="text-sm">
                    {new Date(ip.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <AuditLogList logs={auditLogs} />
          </TabsContent>
        </Tabs>

        {(canEdit || canDelete) && (
        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={isLoading}
              >
                취소
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? "저장 중..." : "저장"}
              </Button>
            </>
          ) : (
            <>
              {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isLoading}>
                    삭제
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>IP 삭제 확인</AlertDialogTitle>
                    <AlertDialogDescription>
                      {ip.ip_address}를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              )}
              {canEdit && <Button onClick={() => setIsEditing(true)}>수정</Button>}
            </>
          )}
        </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
