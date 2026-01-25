import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "./user-management";
import { AuditLogViewer } from "./audit-log-viewer";

async function getCurrentUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

async function getUsers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching users:", error);
    return [];
  }

  return data ?? [];
}

export default async function SettingsPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const isAdmin = profile.role === "admin";
  const users = isAdmin ? await getUsers() : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="text-muted-foreground">계정 및 시스템 설정을 관리하세요</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">내 프로필</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">사용자 관리</TabsTrigger>}
          {(isAdmin || profile.role === "sub_admin") && (
            <TabsTrigger value="audit">감사 로그</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>내 프로필</CardTitle>
              <CardDescription>계정 정보를 확인하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">이메일</label>
                <p className="font-medium">{profile.email}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">역할</label>
                <p className="font-medium">
                  {profile.role === "admin"
                    ? "관리자"
                    : profile.role === "sub_admin"
                    ? "부관리자"
                    : "사용자"}
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">가입일</label>
                <p className="font-medium">
                  {new Date(profile.created_at).toLocaleDateString("ko-KR")}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>사용자 관리</CardTitle>
                <CardDescription>
                  사용자의 역할을 관리하세요 (관리자 전용)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UserManagement users={users} currentUserId={profile.id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {(isAdmin || profile.role === "sub_admin") && (
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>감사 로그</CardTitle>
                <CardDescription>시스템 변경 이력을 확인하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <AuditLogViewer />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
