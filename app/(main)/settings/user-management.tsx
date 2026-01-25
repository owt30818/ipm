"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Profile } from "@/lib/types/database";

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

export function UserManagement({ users, currentUserId }: UserManagementProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

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
      const supabase = createClient();

      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) {
        throw new Error(error.message);
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

  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        등록된 사용자가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
                    {new Date(user.created_at).toLocaleDateString("ko-KR")}
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
                    {new Date(user.created_at).toLocaleDateString("ko-KR")}
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
