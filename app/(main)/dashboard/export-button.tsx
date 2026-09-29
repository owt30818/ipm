"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { exportIpsToCsv } from "@/app/actions/export-ips";
import { Download, Loader2 } from "lucide-react";

export function ExportButton() {
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const handleExport = async () => {
    setIsLoading(true);

    try {
      const filters = {
        status: searchParams.get("status") || undefined,
        subnetId: searchParams.get("subnet") || undefined,
        description: searchParams.get("description") || undefined,
        ipAddress: searchParams.get("ip") || undefined,
      };

      const result = await exportIpsToCsv(filters);

      if (result.error) {
        toast({
          title: "내보내기 실패",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      if (result.csv) {
        const BOM = "\uFEFF";
        const blob = new Blob([BOM + result.csv], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        link.download = `ip-addresses-${dateStr}.csv`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: "내보내기 완료",
          description: `${result.count}개의 IP 주소를 CSV로 내보냈습니다.`,
        });
      }
    } catch {
      toast({
        title: "내보내기 실패",
        description: "오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={isLoading} variant="outline">
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-2" />
      )}
      CSV 내보내기
    </Button>
  );
}
