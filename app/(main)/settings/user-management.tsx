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
import { MoreHorizontal, Trash2, KeyRound } from "lucide-react";
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
import { deleteUser } from "@/app/actions/delete-user";
import { adminUpdatePassword } from "@/app/actions/admin-update-password";
import { toKoreanError } from "@/lib/errors";

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

  // Password Reset State
  const [isPasswordResetDialogOpen, setIsPasswordResetDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  // Delete User State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // Using selectedUser for delete as well

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
        description: toKoreanError(error),
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
        description: toKoreanError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  const openDeleteDialog = (user: Profile) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsLoading(selectedUser.id);

    try {
      const result = await deleteUser(selectedUser.id);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: "사용자 삭제 완료",
        description: `${selectedUser.email} 사용자가 삭제되었습니다.`,
      });

      router.refresh();
    } catch (error) {
      toast({
        title: "사용자 삭제 실패",
        description: toKoreanError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    }
  };

  const openPasswordResetDialog = (user: Profile) => {
    setSelectedUser(user);
    setResetPassword("");
    setIsPasswordResetDialogOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsLoading(selectedUser.id);

    try {
      const result = await adminUpdatePassword(selectedUser.id, resetPassword);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: "비밀번호 변경 완료",
        description: `${selectedUser.email} 사용자의 비밀번호가 변경되었습니다.`,
      });

      setIsPasswordResetDialogOpen(false);
      setResetPassword("");
      setSelectedUser(null);
    } catch (error) {
      toast({
        title: "비밀번호 변경 실패",
        description: toKoreanError(error),
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

  const passwordResetDialog = (
    <Dialog open={isPasswordResetDialogOpen} onOpenChange={setIsPasswordResetDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>비밀번호 초기화</DialogTitle>
          <DialogDescription>
            {selectedUser?.email} 사용자의 새 비밀번호를 설정합니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleResetPassword}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="resetPassword" className="text-sm font-medium">
                새 비밀번호
              </label>
              <Input
                id="resetPassword"
                type="password"
                placeholder="최소 6자 이상"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                disabled={isLoading === selectedUser?.id}
                required
                minLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPasswordResetDialogOpen(false)}
              disabled={isLoading === selectedUser?.id}
            >
              취소
            </Button>
            <Button type="submit" disabled={isLoading === selectedUser?.id}>
              {isLoading === selectedUser?.id ? "변경 중..." : "변경"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  const deleteConfirmDialog = (
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
          <AlertDialogDescription>
            {selectedUser?.email} 사용자를 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setSelectedUser(null)}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteUser}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
        {passwordResetDialog}
        {deleteConfirmDialog}
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
              <TableHead className="w-[50px]"></TableHead>
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
                  <TableCell>
                    {!isCurrentUser && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">메뉴 열기</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openPasswordResetDialog(user)}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            <span>비밀번호 변경</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(user)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>사용자 삭제</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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

              {/* Mobile Actions */}
              {
                !isCurrentUser && (
                  <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPasswordResetDialog(user)}
                    >
                      <KeyRound className="mr-2 h-3 w-3" />
                      암호 변경
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      onClick={() => openDeleteDialog(user)}
                    >
                      <Trash2 className="mr-2 h-3 w-3" />
                      삭제
                    </Button>
                  </div>
                )
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}
