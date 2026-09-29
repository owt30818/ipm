"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { IpAddressWithSubnet, AuditLog } from "@/lib/types/database";
import { useToast } from "@/hooks/use-toast";
import { CopyIpButton } from "@/components/ip/copy-ip-button";
import { toKoreanError } from "@/lib/errors";

type IpStatus = "available" | "allocated" | "reserved" | "deprecated";

const statusConfig = {
  available: { label: "사용 가능", className: "bg-green-100 text-green-800" },
  allocated: { label: "할당됨", className: "bg-blue-100 text-blue-800" },
  reserved: { label: "예약됨", className: "bg-yellow-100 text-yellow-800" },
  deprecated: { label: "사용 안 함", className: "bg-gray-100 text-gray-800" },
};

interface IpAddressListProps {
  ipAddresses: IpAddressWithSubnet[];
  canEdit?: boolean;
  canDelete?: boolean;
}

export function IpAddressList({ ipAddresses, canEdit = false, canDelete = false }: IpAddressListProps) {
  if (ipAddresses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        등록된 IP 주소가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ipAddresses.map((ip) => (
        <IpCard key={ip.id} ip={ip} canEdit={canEdit} canDelete={canDelete} />
      ))}
    </div>
  );
}

function IpCard({
  ip,
  canEdit,
  canDelete,
}: {
  ip: IpAddressWithSubnet;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<IpStatus>(ip.status);
  const [description, setDescription] = useState(ip.description || "");
  const [allocatedTo, setAllocatedTo] = useState(ip.allocated_to || "");
  const [isLoading, setIsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const currentStatus = statusConfig[ip.status];

  useEffect(() => {
    if (drawerOpen) {
      setStatus(ip.status);
      setDescription(ip.description || "");
      setAllocatedTo(ip.allocated_to || "");
      setIsEditing(false);
    }
  }, [drawerOpen, ip]);

  const handleSave = async () => {
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
      setDrawerOpen(false);
      router.refresh();
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

      setDrawerOpen(false);
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

  return (
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
      <DrawerTrigger asChild>
        <Card className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1">
                <span className="font-mono font-medium">{ip.ip_address}</span>
                <CopyIpButton ip={ip.ip_address} />
              </span>
              <Badge className={currentStatus.className}>{currentStatus.label}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="truncate">{ip.description ?? "설명 없음"}</p>
              <p className="mt-1">
                {ip.subnet?.name ?? "-"} ({ip.subnet?.cidr ?? "-"})
              </p>
            </div>
          </CardContent>
        </Card>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="font-mono">{ip.ip_address}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4 space-y-4">
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
                  placeholder="IP에 대한 설명"
                  rows={3}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">상태:</span>
                <Badge className={currentStatus.className}>{currentStatus.label}</Badge>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">서브넷:</span>
                <p className="font-medium">
                  {ip.subnet?.name ?? "-"} ({ip.subnet?.cidr ?? "-"})
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">설명:</span>
                <p className="font-medium">{ip.description ?? "-"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">할당 대상:</span>
                <p className="font-medium">{ip.allocated_to ?? "-"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">할당일:</span>
                <p className="font-medium">
                  {ip.allocated_at
                    ? new Date(ip.allocated_at).toLocaleDateString("ko-KR")
                    : "-"}
                </p>
              </div>
            </>
          )}
        </div>
        {(canEdit || canDelete) && (
        <DrawerFooter>
          {isEditing ? (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsEditing(false)}
                disabled={isLoading}
              >
                취소
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={isLoading}>
                {isLoading ? "저장 중..." : "저장"}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 w-full">
              {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex-1" disabled={isLoading}>
                    삭제
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>IP 삭제 확인</AlertDialogTitle>
                    <AlertDialogDescription>
                      {ip.ip_address}를 삭제하시겠습니까?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              )}
              {canEdit && (
                <Button className="flex-1" onClick={() => setIsEditing(true)}>
                  수정
                </Button>
              )}
            </div>
          )}
        </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
