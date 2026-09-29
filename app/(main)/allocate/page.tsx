import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { canDelete, canManage } from "@/lib/roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AllocateForm } from "./allocate-form";
import { CsvUpload } from "./csv-upload";
import { SubnetForm } from "./subnet-form";

async function getSubnets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subnets")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching subnets:", error);
    return [];
  }

  return data ?? [];
}

// Registered IP count per subnet (shown in the delete confirmation); undefined if it cannot be loaded
async function getSubnetIpCounts(): Promise<Record<string, number> | undefined> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (supabase.rpc as any)("get_subnet_stats")) as {
    data: { id: string; registered: number }[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    console.error("Error fetching subnet IP counts:", error);
    return undefined;
  }

  return Object.fromEntries(data.map((row) => [row.id, Number(row.registered)]));
}

export default async function AllocatePage() {
  const session = await getSessionProfile();

  if (!session) {
    redirect("/login");
  }

  if (!canManage(session.role)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">IP 할당</h1>
          <p className="text-muted-foreground">IP 주소를 할당하고 관리하세요</p>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            IP 할당은 관리자 또는 부관리자만 사용할 수 있습니다.
            <br />
            권한이 필요하면 관리자에게 문의하세요.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [subnets, ipCounts] = await Promise.all([getSubnets(), getSubnetIpCounts()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">IP 할당</h1>
        <p className="text-muted-foreground">IP 주소를 할당하고 관리하세요</p>
      </div>

      <Tabs defaultValue="single" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-grid">
          <TabsTrigger value="single">단일 할당</TabsTrigger>
          <TabsTrigger value="bulk">CSV 업로드</TabsTrigger>
          <TabsTrigger value="subnet">서브넷 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>IP 주소 할당</CardTitle>
              <CardDescription>
                새로운 IP 주소를 등록하거나 할당하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AllocateForm subnets={subnets} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>CSV 대량 업로드</CardTitle>
              <CardDescription>
                CSV 파일로 여러 IP 주소를 한 번에 등록하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CsvUpload subnets={subnets} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subnet">
          <Card>
            <CardHeader>
              <CardTitle>서브넷 관리</CardTitle>
              <CardDescription>
                IP 주소를 그룹화할 서브넷을 관리하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubnetForm subnets={subnets} ipCounts={ipCounts} canDelete={canDelete(session.role)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
