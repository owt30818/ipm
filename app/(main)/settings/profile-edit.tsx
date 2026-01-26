"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { updatePassword } from "@/app/actions/update-password";

interface ProfileEditProps {
  email: string;
  role: string;
  createdAt: string;
}

export function ProfileEdit({ email, role, createdAt }: ProfileEditProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const roleLabel =
    role === "admin" ? "관리자" : role === "sub_admin" ? "부관리자" : "사용자";

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "비밀번호 불일치",
        description: "새 비밀번호와 확인 비밀번호가 일치하지 않습니다.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "비밀번호 오류",
        description: "비밀번호는 최소 6자 이상이어야 합니다.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await updatePassword(newPassword);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: "비밀번호 변경 완료",
        description: "비밀번호가 성공적으로 변경되었습니다.",
      });

      setIsOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast({
        title: "비밀번호 변경 실패",
        description:
          error instanceof Error ? error.message : "오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-muted-foreground">이메일</label>
        <p className="font-medium">{email}</p>
      </div>
      <div>
        <label className="text-sm text-muted-foreground">역할</label>
        <p className="font-medium">{roleLabel}</p>
      </div>
      <div>
        <label className="text-sm text-muted-foreground">가입일</label>
        <p className="font-medium">
          {new Date(createdAt).toLocaleDateString("ko-KR")}
        </p>
      </div>

      <div className="pt-4 border-t">
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="outline">비밀번호 변경</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>비밀번호 변경</DialogTitle>
              <DialogDescription>
                새로운 비밀번호를 입력하세요. 최소 6자 이상이어야 합니다.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasswordChange}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="newPassword" className="text-sm font-medium">
                    새 비밀번호
                  </label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="새 비밀번호 입력"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="confirmPassword"
                    className="text-sm font-medium"
                  >
                    비밀번호 확인
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="비밀번호 다시 입력"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isLoading}
                >
                  취소
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "변경 중..." : "변경"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
