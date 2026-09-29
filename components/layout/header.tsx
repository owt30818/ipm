"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { roleLabels, type UserRole } from "@/lib/roles";
import { MobileNav } from "./mobile-nav";
import { useToast } from "@/hooks/use-toast";
import { toKoreanError } from "@/lib/errors";

interface HeaderProps {
  userEmail?: string;
  role?: UserRole;
}

export function Header({ userEmail, role }: HeaderProps) {
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast({
        title: "로그아웃 실패",
        description: toKoreanError(error),
        variant: "destructive",
      });
      return;
    }

    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        <div className="flex items-center gap-4">
          <MobileNav role={role} />
          <h1 className="text-lg font-semibold md:hidden">IPAM</h1>
        </div>
        <div className="flex items-center gap-4">
          {role && (
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {roleLabels[role]}
            </Badge>
          )}
          {userEmail && (
            <Link
              href="/settings"
              className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {userEmail}
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={handleLogout}>
            로그아웃
          </Button>
        </div>
      </div>
    </header>
  );
}
