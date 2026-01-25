"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
                    <div>
                      <p className="font-medium">{subnet.name}</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {subnet.cidr}
                      </p>
                    </div>
                    <Badge variant="outline">활성</Badge>
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
    </div>
  );
}
