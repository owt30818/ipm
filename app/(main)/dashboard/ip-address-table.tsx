"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IpAddressWithSubnet } from "@/lib/types/database";
import { IpDetailDialog } from "@/components/ip/ip-detail-dialog";
import { CopyIpButton } from "@/components/ip/copy-ip-button";
import { formatDateTimeKst } from "@/lib/utils";
import { deleteIps } from "@/app/actions/bulk-delete-ips";
import { updateIps } from "@/app/actions/bulk-update-ips";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Edit, CheckSquare, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { toKoreanError } from "@/lib/errors";

const statusConfig = {
  available: { label: "사용 가능", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  allocated: { label: "할당됨", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  reserved: { label: "예약됨", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  deprecated: { label: "사용 안 함", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
};

interface IpAddressTableProps {
  ipAddresses: IpAddressWithSubnet[];
  canEdit?: boolean;
  canDelete?: boolean;
}

export function IpAddressTable({ ipAddresses, canEdit = false, canDelete = false }: IpAddressTableProps) {
  // Row selection only exists for bulk actions the role is allowed to run
  const selectable = canEdit || canDelete;
  const [selectedIp, setSelectedIp] = useState<IpAddressWithSubnet | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  if (ipAddresses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        등록된 IP 주소가 없습니다.
      </div>
    );
  }

  const handleRowClick = (ip: IpAddressWithSubnet) => {
    setSelectedIp(ip);
    setDialogOpen(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(ipAddresses.map((ip) => ip.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    setIsLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await deleteIps(ids);

      if (result.error) throw new Error(result.error);

      toast({
        title: "삭제 완료",
        description: `${result.count ?? ids.length}개의 IP가 삭제되었습니다.`,
      });
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      toast({
        title: "삭제 실패",
        description: toKoreanError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleBulkStatusUpdate = async (status: "available" | "allocated" | "reserved" | "deprecated") => {
    setIsLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await updateIps(ids, { status });

      if (result.error) throw new Error(result.error);

      toast({
        title: "상태 변경 완료",
        description: `${result.count ?? ids.length}개의 IP 상태가 변경되었습니다.`,
      });
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      toast({
        title: "변경 실패",
        description: toKoreanError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {selectable && selectedIds.size > 0 && (
          <div className="flex items-center justify-between bg-muted/50 p-2 rounded-md border animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium ml-2">
                {selectedIds.size}개 선택됨
              </span>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isLoading}>
                    <Edit className="w-4 h-4 mr-2" />
                    상태 변경
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("available")}>
                    사용 가능으로 변경
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("allocated")}>
                    할당됨으로 변경
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("reserved")}>
                    예약됨으로 변경
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusUpdate("deprecated")}>
                    사용 안 함으로 변경
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              )}

              {canDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={isLoading}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  삭제
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        selectedIds.size === ipAddresses.length && ipAddresses.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                <TableHead>IP 주소</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>서브넷</TableHead>
                <TableHead>설명</TableHead>
                <TableHead>할당 대상</TableHead>
                <TableHead>할당 일시</TableHead>
                <TableHead>등록 일시</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ipAddresses.map((ip) => {
                const status = statusConfig[ip.status];
                const isSelected = selectedIds.has(ip.id);
                return (
                  <TableRow
                    key={ip.id}
                    className="cursor-pointer hover:bg-muted/50 data-[state=selected]:bg-muted"
                    data-state={isSelected ? "selected" : undefined}
                    onClick={(e) => {
                      // Prevent row click when clicking checkbox
                      if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
                      handleRowClick(ip);
                    }}
                  >
                    {selectable && (
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectOne(ip.id, !!checked)}
                          aria-label={`Select ${ip.ip_address}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-mono font-medium">
                      <div className="flex items-center gap-1">
                        <span>{ip.ip_address}</span>
                        <CopyIpButton ip={ip.ip_address} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={status.className}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {ip.subnet?.name ?? "-"}
                        <span className="text-muted-foreground ml-1">
                          ({ip.subnet?.cidr ?? "-"})
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {ip.description ?? "-"}
                    </TableCell>
                    <TableCell>{ip.allocated_to ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {ip.allocated_at ? formatDateTimeKst(ip.allocated_at) : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                      {formatDateTimeKst(ip.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <IpDetailDialog
        ip={selectedIp}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>선택한 IP 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 {selectedIds.size}개의 IP 주소를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleBulkDelete();
              }}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
