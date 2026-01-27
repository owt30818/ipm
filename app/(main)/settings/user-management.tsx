"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Profile } from "@/lib/types/database";
import { createUser } from "@/app/actions/create-user";

type UserRole = "admin" | "sub_admin" | "user";

const roleLabels = {
  admin: { label: "관리자", className: "bg-red-100 text-red-800" },
  sub_admin: { label: "부관리자", className: "bg-yellow-100 text-yellow-800" },
  user: { label: "사용자", className: "bg-gray-100 text-gray-800" },
};

interface UserManagementProps {
  users: Profile[];
  currentUserId: string;
}

type NewUserRole = "sub_admin" | "user";

export function UserManagement({ users, currentUserId }: UserManagementProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<NewUserRole>("user");
  const router = useRouter();
  const { toast } = useToast();

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const result = await createUser({
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: "사용자 추가 완료",
        description: `${newUserEmail} 사용자가 추가되었습니다.`,
      });

      setIsDialogOpen(false);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("user");
      router.refresh();
    } catch (error) {
      toast({
        title: "사용자 추가 실패",
        description: error instanceof Error ? error.message : "오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("user");
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (userId === currentUserId) {
      toast({
        title: "변경 불가",
        description: "자신의 역할은 변경할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(userId);

    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "역할 변경에 실패했습니다.");
      }

      toast({
        title: "역할 변경 완료",
        description: "사용자 역할이 변경되었습니다.",
      });

      router.refresh();
    } catch (error) {
      toast({
        title: "역할 변경 실패",
        description: error instanceof Error ? error.message : "오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  const addUserDialog = (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button>사용자 추가</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 사용자 추가</DialogTitle>
          <DialogDescription>
            새로운 사용자 계정을 생성합니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateUser}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="newUserEmail" className="text-sm font-medium">
                이메일
              </label>
              <Input
                id="newUserEmail"
                type="email"
                placeholder="user@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                disabled={isCreating}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="newUserPassword" className="text-sm font-medium">
                비밀번호
              </label>
              <Input
                id="newUserPassword"
                type="password"
                placeholder="최소 6자 이상"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                disabled={isCreating}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="newUserRole" className="text-sm font-medium">
                역할
              </label>
              <Select
                value={newUserRole}
                onValueChange={(value) => setNewUserRole(value as NewUserRole)}
                disabled={isCreating}
              >
                <SelectTrigger id="newUserRole">
                  <SelectValue placeholder="역할 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sub_admin">부관리자</SelectItem>
                  <SelectItem value="user">사용자</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={isCreating}
            >
              취소
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "추가 중..." : "추가"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  if (users.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          {addUserDialog}
        </div>
        <div className="text-center py-8 text-muted-foreground">
          등록된 사용자가 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {addUserDialog}
      </div>
      {/* Desktop View */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이메일</TableHead>
              <TableHead>역할</TableHead>
              <TableHead>가입일</TableHead>
              <TableHead>역할 변경</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const roleConfig = roleLabels[user.role];
              const isCurrentUser = user.id === currentUserId;

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    {user.email}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs text-muted-foreground">(나)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={roleConfig.className}>{roleConfig.label}</Badge>
                  </TableCell>
                  <TableCell>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString("ko-KR") : "-"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) =>
                        handleRoleChange(user.id, value as UserRole)
                      }
                      disabled={isCurrentUser || isLoading === user.id}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">관리자</SelectItem>
                        <SelectItem value="sub_admin">부관리자</SelectItem>
                        <SelectItem value="user">사용자</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {users.map((user) => {
          const roleConfig = roleLabels[user.role];
          const isCurrentUser = user.id === currentUserId;

          return (
            <div key={user.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {user.email}
                    {isCurrentUser && (
                      <span className="ml-1 text-xs text-muted-foreground">(나)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString("ko-KR") : "-"}
                  </p>
                </div>
                <Badge className={roleConfig.className}>{roleConfig.label}</Badge>
              </div>
              <Select
                value={user.role}
                onValueChange={(value) =>
                  handleRoleChange(user.id, value as UserRole)
                }
                disabled={isCurrentUser || isLoading === user.id}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="역할 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="sub_admin">부관리자</SelectItem>
                  <SelectItem value="user">사용자</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
