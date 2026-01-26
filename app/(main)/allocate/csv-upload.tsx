"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Subnet, IpAddressInsert } from "@/lib/types/database";

interface CsvUploadProps {
  subnets: Subnet[];
}

interface CsvRow {
  [key: string]: string;
}

interface ParsedIpRow {
  ip_address: string;
  status: IpStatus;
  description?: string;
  allocated_to?: string;
}

type IpStatus = "available" | "allocated" | "reserved" | "deprecated";

const validStatuses: IpStatus[] = ["available", "allocated", "reserved", "deprecated"];

function parseStatus(status?: string): IpStatus {
  const trimmed = status?.trim().toLowerCase();
  if (trimmed && validStatuses.includes(trimmed as IpStatus)) {
    return trimmed as IpStatus;
  }
  return "allocated"; // 기본값을 allocated로 변경
}

// IP 주소 패턴 검증
const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;

function isValidIp(str: string): boolean {
  const trimmed = str?.trim();
  if (!trimmed || !ipPattern.test(trimmed)) return false;
  const parts = trimmed.split(".").map(Number);
  return parts.every((p) => p >= 0 && p <= 255);
}

// CSV 행을 파싱하여 IP 데이터로 변환
function parseCsvRow(row: CsvRow, headers: string[]): ParsedIpRow | null {
  // 헤더가 있는 경우 (ip_address 컬럼)
  if (row.ip_address && isValidIp(row.ip_address)) {
    return {
      ip_address: row.ip_address.trim(),
      status: parseStatus(row.status),
      description: row.description?.trim() || undefined,
      allocated_to: row.allocated_to?.trim() || undefined,
    };
  }

  // 첫 번째 컬럼이 IP인 경우 (헤더 없거나 다른 헤더명)
  const firstKey = headers[0];
  const firstValue = row[firstKey];
  if (firstValue && isValidIp(firstValue)) {
    const secondKey = headers[1];
    const description = secondKey ? row[secondKey]?.trim() : undefined;
    return {
      ip_address: firstValue.trim(),
      status: "allocated",
      description: description || undefined,
    };
  }

  return null;
}

export function CsvUpload({ subnets }: CsvUploadProps) {
  const [subnetId, setSubnetId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedIpRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleFile = (file: File) => {
    setFile(file);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const parsed = results.data
          .map((row) => parseCsvRow(row, headers))
          .filter((r): r is ParsedIpRow => r !== null);
        setPreview(parsed.slice(0, 5));
      },
      error: (error) => {
        toast({
          title: "파일 파싱 오류",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === "text/csv" || droppedFile?.name.endsWith(".csv")) {
      handleFile(droppedFile);
    } else {
      toast({
        title: "잘못된 파일 형식",
        description: "CSV 파일만 업로드할 수 있습니다.",
        variant: "destructive",
      });
    }
  };

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

    if (!file) {
      toast({
        title: "파일 필요",
        description: "CSV 파일을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      Papa.parse<CsvRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const headers = results.meta.fields || [];
          const rows = results.data
            .map((row) => parseCsvRow(row, headers))
            .filter((r): r is ParsedIpRow => r !== null);

          if (rows.length === 0) {
            toast({
              title: "데이터 없음",
              description: "유효한 IP 주소가 없습니다.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }

          const insertData: IpAddressInsert[] = rows.map((row) => ({
            subnet_id: subnetId,
            ip_address: row.ip_address,
            status: row.status,
            description: row.description,
            allocated_to: row.allocated_to,
          }));

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await supabase.from("ip_addresses").insert(insertData as any);

          if (error) {
            throw new Error(error.message);
          }

          toast({
            title: "업로드 완료",
            description: `${rows.length}개의 IP 주소가 등록되었습니다.`,
          });

          setFile(null);
          setPreview([]);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }

          router.refresh();
          setIsLoading(false);
        },
        error: (error) => {
          throw new Error(error.message);
        },
      });
    } catch (error) {
      toast({
        title: "업로드 실패",
        description:
          error instanceof Error ? error.message : "오류가 발생했습니다.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">서브넷</label>
        <Select value={subnetId} onValueChange={setSubnetId}>
          <SelectTrigger>
            <SelectValue placeholder="서브넷을 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {subnets.length === 0 ? (
              <SelectItem value="none" disabled>
                서브넷이 없습니다
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

      {/* Desktop: Drag & Drop Zone */}
      <div
        className={`hidden md:flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-gray-300 dark:border-gray-700"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <svg
          className="w-12 h-12 text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="text-sm text-muted-foreground mb-2">
          CSV 파일을 드래그하여 놓거나
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          파일 선택
        </Button>
        <Input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) handleFile(selectedFile);
          }}
        />
      </div>

      {/* Mobile: File Picker Button */}
      <div className="md:hidden space-y-2">
        <label className="text-sm font-medium">CSV 파일</label>
        <Input
          type="file"
          accept=".csv"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) handleFile(selectedFile);
          }}
        />
      </div>

      {file && (
        <div className="text-sm text-muted-foreground">
          선택된 파일: {file.name}
        </div>
      )}

      {preview.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">미리보기 (처음 5개)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="px-3 py-2 text-left border-b">IP 주소</th>
                  <th className="px-3 py-2 text-left border-b">상태</th>
                  <th className="px-3 py-2 text-left border-b">설명</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 border-b font-mono">
                      {row.ip_address}
                    </td>
                    <td className="px-3 py-2 border-b">
                      {row.status}
                    </td>
                    <td className="px-3 py-2 border-b truncate max-w-[200px]">
                      {row.description || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
        <p className="font-medium mb-2">CSV 파일 형식:</p>
        <p className="text-xs text-muted-foreground mb-2">형식 1: 간단한 형식 (IP,설명)</p>
        <code className="text-xs block mb-3 bg-gray-100 dark:bg-gray-900 p-2 rounded">
          10.161.48.11,웹서버
          <br />
          10.161.48.12,DB서버
        </code>
        <p className="text-xs text-muted-foreground mb-2">형식 2: 상세 형식</p>
        <code className="text-xs block bg-gray-100 dark:bg-gray-900 p-2 rounded">
          ip_address,status,description,allocated_to
          <br />
          10.161.48.100,allocated,웹서버,server-01
        </code>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading || !file}>
        {isLoading ? "업로드 중..." : "CSV 업로드"}
      </Button>
    </form>
  );
}
