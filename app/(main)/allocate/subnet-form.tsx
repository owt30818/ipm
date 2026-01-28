"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Subnet, SubnetInsert } from "@/lib/types/database";

interface SubnetFormProps {
  subnets: Subnet[];
}

export function SubnetForm({ subnets }: SubnetFormProps) {
  const [name, setName] = useState("");
  const [cidr, setCidr] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 수정 다이얼로그 상태
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<Subnet | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // 삭제 다이얼로그 상태
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSubnet, setDeletingSubnet] = useState<Subnet | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !cidr) {
      toast({
        title: "필수 항목",
        description: "이름과 CIDR은 필수입니다.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();

      const insertData: SubnetInsert = {
        name,
        cidr,
      };

      if (description) {
        insertData.description = description;
      }

      if (user) {
        insertData.created_by = user.id;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("subnets").insert(insertData as any);

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "서브넷 등록 완료",
        description: `${name} 서브넷이 등록되었습니다.`,
      });

      setName("");
      setCidr("");
      setDescription("");

      router.refresh();
    } catch (error) {
      toast({
        title: "등록 실패",
        description:
          error instanceof Error ? error.message : "오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (subnet: Subnet) => {
    setEditingSubnet(subnet);
    setEditName(subnet.name);
    setEditDescription(subnet.description || "");
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!editingSubnet || !editName) {
      toast({
        title: "필수 항목",
        description: "이름은 필수입니다.",
        variant: "destructive",
      });
      return;
    }

    setIsEditing(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("subnets")
        .update({
          name: editName,
          description: editDescription || null,
        })
        .eq("id", editingSubnet.id);

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "수정 완료",
        description: `${editName} 서브넷이 수정되었습니다.`,
      });

      setEditDialogOpen(false);
      setEditingSubnet(null);
      router.refresh();
    } catch (error) {
      toast({
        title: "수정 실패",
        description:
          error instanceof Error ? error.message : "오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsEditing(false);
    }
  };

  const openDeleteDialog = (subnet: Subnet) => {
    setDeletingSubnet(subnet);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingSubnet) return;

    setIsDeleting(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("subnets")
        .delete()
        .eq("id", deletingSubnet.id);

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "삭제 완료",
        description: `${deletingSubnet.name} 서브넷이 삭제되었습니다.`,
      });

      setDeleteDialogOpen(false);
      setDeletingSubnet(null);
      router.refresh();
    } catch (error) {
      toast({
        title: "삭제 실패",
        description:
          error instanceof Error ? error.message : "오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">서브넷 이름</label>
          <Input
            type="text"
            placeholder="Production Network"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">CIDR</label>
          <Input
            type="text"
            placeholder="192.168.1.0/24"
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">설명</label>
          <Textarea
            placeholder="서브넷에 대한 설명을 입력하세요"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={isLoading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "등록 중..." : "서브넷 등록"}
        </Button>
      </form>

      {subnets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">등록된 서브넷</h3>
          <div className="space-y-2">
            {subnets.map((subnet) => (
              <Card key={subnet.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{subnet.name}</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {subnet.cidr}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">활성</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(subnet)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            수정
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(subnet)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {subnet.description && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {subnet.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>서브넷 수정</DialogTitle>
            <DialogDescription>
              서브넷 정보를 수정하세요. CIDR은 변경할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">CIDR (변경 불가)</label>
              <Input
                value={editingSubnet?.cidr || ""}
                disabled
                className="bg-gray-100 dark:bg-gray-800"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">서브넷 이름</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={isEditing}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">설명</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                disabled={isEditing}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isEditing}
            >
              취소
            </Button>
            <Button onClick={handleEdit} disabled={isEditing}>
              {isEditing ? "수정 중..." : "수정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>서브넷 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingSubnet?.name}</strong> 서브넷을 삭제하시겠습니까?
              <br />
              <span className="text-red-600">
                이 서브넷에 속한 모든 IP 주소도 함께 삭제됩니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
