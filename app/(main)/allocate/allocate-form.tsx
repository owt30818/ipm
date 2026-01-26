"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { allocateIps } from "@/app/actions/allocate-ips";
import { getNextAvailableIp } from "@/app/actions/get-next-available-ip";
import { Subnet, IpAddressInsert } from "@/lib/types/database";

interface AllocateFormProps {
  subnets: Subnet[];
}

type IpStatus = "available" | "allocated" | "reserved" | "deprecated";

export function AllocateForm({ subnets }: AllocateFormProps) {
  const [allocationMode, setAllocationMode] = useState<"single" | "auto">("single");
  const [subnetId, setSubnetId] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<IpStatus>("available");
  const [description, setDescription] = useState("");
  const [allocatedTo, setAllocatedTo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingIp, setIsFetchingIp] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubnetChange = useCallback(async (newSubnetId: string) => {
    setSubnetId(newSubnetId);

    // 단일 할당 모드일 때만 다음 가용 IP 자동 채움
    if (allocationMode === "single" && newSubnetId) {
      setIsFetchingIp(true);
      try {
        const result = await getNextAvailableIp(newSubnetId);
        if (result.ip) {
          setIpAddress(result.ip);
        } else if (result.error) {
          toast({
            title: "알림",
            description: result.error,
            variant: "destructive",
          });
        }
      } catch {
        // 에러 무시
      } finally {
        setIsFetchingIp(false);
      }
    }
  }, [allocationMode, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subnetId) {
      toast({
        title: "서브넷 필요",
        description: "서브넷을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (allocationMode === "single" && !ipAddress) {
      toast({
        title: "IP 주소 필요",
        description: "IP 주소를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (allocationMode === "auto") {
        const result = await allocateIps(subnetId, quantity, description);
        if (result.error) {
          throw new Error(result.error);
        }

        const allocatedCount = result.data?.length || 0;
        toast({
          title: "자동 할당 완료",
          description: `${allocatedCount}개의 IP가 할당되었습니다.`,
        });
      } else {
        const supabase = createClient();

        const insertData: IpAddressInsert = {
          subnet_id: subnetId,
          ip_address: ipAddress,
          status,
        };

        if (description) {
          insertData.description = description;
        }

        if (allocatedTo) {
          insertData.allocated_to = allocatedTo;
        }

        if (status === "allocated" && allocatedTo) {
          insertData.allocated_at = new Date().toISOString();
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from("ip_addresses").insert(insertData as any);

        if (error) {
          throw new Error(error.message);
        }

        toast({
          title: "등록 완료",
          description: `${ipAddress} 주소가 등록되었습니다.`,
        });

        // 단일 할당 후 다음 가용 IP 자동 갱신
        if (subnetId) {
          const result = await getNextAvailableIp(subnetId);
          if (result.ip) {
            setIpAddress(result.ip);
          } else {
            setIpAddress("");
          }
        }
      }

      // Reset form (IP는 위에서 처리)
      if (allocationMode === "auto") {
        setIpAddress("");
      }
      setQuantity(1);
      setDescription("");
      setAllocatedTo("");
      setStatus("allocated");

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        <Tabs value={allocationMode} onValueChange={(v) => setAllocationMode(v as "single" | "auto")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">단일 할당</TabsTrigger>
            <TabsTrigger value="auto">자동 할당</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">서브넷</label>
        <Select value={subnetId} onValueChange={handleSubnetChange}>
          <SelectTrigger>
            <SelectValue placeholder="서브넷을 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {subnets.length === 0 ? (
              <SelectItem value="none" disabled>
                서브넷이 없습니다. 먼저 서브넷을 추가하세요.
              </SelectItem>
            ) : (
              subnets.map((subnet) => (
                <SelectItem key={subnet.id} value={subnet.id}>
                  {subnet.name} ({subnet.cidr})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {allocationMode === "single" ? (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">IP 주소</label>
            <Input
              type="text"
              placeholder={isFetchingIp ? "다음 가용 IP 조회 중..." : "192.168.1.100"}
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              pattern="^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
              title="올바른 IPv4 주소를 입력하세요"
              disabled={isLoading || isFetchingIp}
            />
            <p className="text-xs text-muted-foreground">
              서브넷 선택 시 다음 가용 IP가 자동으로 채워집니다.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">상태</label>
            <Select value={status} onValueChange={(value) => setStatus(value as IpStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">사용 가능</SelectItem>
                <SelectItem value="allocated">할당됨</SelectItem>
                <SelectItem value="reserved">예약됨</SelectItem>
                <SelectItem value="deprecated">사용 안 함</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">할당 대상</label>
            <Input
              type="text"
              placeholder="서버명, 사용자 등"
              value={allocatedTo}
              onChange={(e) => setAllocatedTo(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium">요청 수량</label>
          <Input
            type="number"
            min={1}
            max={256}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            선택한 서브넷에서 연속된 IP 주소를 자동으로 찾아 할당합니다.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">설명</label>
        <Textarea
          placeholder="IP 주소에 대한 설명을 입력하세요"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          disabled={isLoading}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "등록 중..." : "IP 주소 등록"}
      </Button>
    </form>
  );
}
