"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  selected: boolean;
  rowIndex: number;
}

interface ColumnMapping {
  ip_address: string;
  status: string;
  description: string;
  allocated_to: string;
}

type IpStatus = "available" | "allocated" | "reserved" | "deprecated";

const validStatuses: IpStatus[] = ["available", "allocated", "reserved", "deprecated"];

const PREVIEW_LIMIT = 10;

function parseStatus(status?: string): IpStatus {
  const trimmed = status?.trim().toLowerCase();
  if (trimmed && validStatuses.includes(trimmed as IpStatus)) {
    return trimmed as IpStatus;
  }
  return "allocated";
}

const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;

function isValidIp(str: string): boolean {
  const trimmed = str?.trim();
  if (!trimmed || !ipPattern.test(trimmed)) return false;
  const parts = trimmed.split(".").map(Number);
  return parts.every((p) => p >= 0 && p <= 255);
}

function applyMapping(
  row: CsvRow,
  mapping: ColumnMapping,
  rowIndex: number
): ParsedIpRow | null {
  const ipValue = mapping.ip_address ? row[mapping.ip_address]?.trim() : "";

  if (!ipValue || !isValidIp(ipValue)) {
    return null;
  }

  return {
    ip_address: ipValue,
    status: parseStatus(mapping.status ? row[mapping.status] : undefined),
    description: mapping.description ? row[mapping.description]?.trim() || undefined : undefined,
    allocated_to: mapping.allocated_to ? row[mapping.allocated_to]?.trim() || undefined : undefined,
    selected: true,
    rowIndex,
  };
}

export function CsvUpload({ subnets }: CsvUploadProps) {
  const [subnetId, setSubnetId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    ip_address: "",
    status: "",
    description: "",
    allocated_to: "",
  });
  const [parsedRows, setParsedRows] = useState<ParsedIpRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const selectedCount = parsedRows.filter((r) => r.selected).length;
  const allSelected = parsedRows.length > 0 && selectedCount === parsedRows.length;
  const previewRows = parsedRows.slice(0, PREVIEW_LIMIT);

  // 매핑 변경 시 parsedRows 재계산
  useEffect(() => {
    if (rawData.length === 0 || !columnMapping.ip_address) {
      setParsedRows([]);
      return;
    }

    const parsed = rawData
      .map((row, idx) => applyMapping(row, columnMapping, idx))
      .filter((r): r is ParsedIpRow => r !== null);

    setParsedRows(parsed);
  }, [rawData, columnMapping]);

  // 헤더 자동 매핑
  const autoDetectMapping = (headers: string[]) => {
    const mapping: ColumnMapping = {
      ip_address: "",
      status: "",
      description: "",
      allocated_to: "",
    };

    const ipKeywords = ["ip", "ip_address", "ipaddress", "address", "ip주소"];
    const statusKeywords = ["status", "상태", "state"];
    const descKeywords = ["description", "desc", "설명", "note", "비고"];
    const allocatedKeywords = ["allocated_to", "allocatedto", "할당", "owner", "user"];

    headers.forEach((h) => {
      const lower = h.toLowerCase();
      if (!mapping.ip_address && ipKeywords.some((k) => lower.includes(k))) {
        mapping.ip_address = h;
      }
      if (!mapping.status && statusKeywords.some((k) => lower.includes(k))) {
        mapping.status = h;
      }
      if (!mapping.description && descKeywords.some((k) => lower.includes(k))) {
        mapping.description = h;
      }
      if (!mapping.allocated_to && allocatedKeywords.some((k) => lower.includes(k))) {
        mapping.allocated_to = h;
      }
    });

    // IP 열을 찾지 못한 경우 첫 번째 열 사용
    if (!mapping.ip_address && headers.length > 0) {
      mapping.ip_address = headers[0];
    }

    return mapping;
  };

  const handleFile = (file: File) => {
    setFile(file);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setRawData(results.data);
        setColumnMapping(autoDetectMapping(headers));
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

  const updateMapping = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping((prev) => ({ ...prev, [field]: value }));
  };

  const toggleRow = (rowIndex: number) => {
    setParsedRows((prev) =>
      prev.map((row) =>
        row.rowIndex === rowIndex ? { ...row, selected: !row.selected } : row
      )
    );
  };

  const toggleAll = () => {
    const newSelected = !allSelected;
    setParsedRows((prev) =>
      prev.map((row) => ({ ...row, selected: newSelected }))
    );
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

  const resetForm = () => {
    setFile(null);
    setRawData([]);
    setCsvHeaders([]);
    setColumnMapping({ ip_address: "", status: "", description: "", allocated_to: "" });
    setParsedRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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

    const selectedRows = parsedRows.filter((r) => r.selected);

    if (selectedRows.length === 0) {
      toast({
        title: "선택된 항목 없음",
        description: "등록할 IP 주소를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const insertData: IpAddressInsert[] = selectedRows.map((row) => ({
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
        description: `${selectedRows.length}개의 IP 주소가 등록되었습니다.`,
      });

      resetForm();
      router.refresh();
    } catch (error) {
      toast({
        title: "업로드 실패",
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
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>선택된 파일: {file.name}</span>
          <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
            초기화
          </Button>
        </div>
      )}

      {/* 열 매핑 UI */}
      {csvHeaders.length > 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <p className="text-sm font-medium">열 매핑 설정</p>
          <p className="text-xs text-muted-foreground">
            CSV 파일의 열을 각 필드에 매핑하세요
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-red-600">IP 주소 (필수)</label>
              <Select
                value={columnMapping.ip_address}
                onValueChange={(v) => updateMapping("ip_address", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="열 선택" />
                </SelectTrigger>
                <SelectContent>
                  {csvHeaders.map((h) => (
                    <SelectItem key={h} value={h} className="text-xs">
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">상태</label>
              <Select
                value={columnMapping.status || "_none_"}
                onValueChange={(v) => updateMapping("status", v === "_none_" ? "" : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="열 선택 (선택사항)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_" className="text-xs text-muted-foreground">
                    사용 안함
                  </SelectItem>
                  {csvHeaders.map((h) => (
                    <SelectItem key={h} value={h} className="text-xs">
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">설명</label>
              <Select
                value={columnMapping.description || "_none_"}
                onValueChange={(v) => updateMapping("description", v === "_none_" ? "" : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="열 선택 (선택사항)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_" className="text-xs text-muted-foreground">
                    사용 안함
                  </SelectItem>
                  {csvHeaders.map((h) => (
                    <SelectItem key={h} value={h} className="text-xs">
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">할당 대상</label>
              <Select
                value={columnMapping.allocated_to || "_none_"}
                onValueChange={(v) => updateMapping("allocated_to", v === "_none_" ? "" : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="열 선택 (선택사항)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_" className="text-xs text-muted-foreground">
                    사용 안함
                  </SelectItem>
                  {csvHeaders.map((h) => (
                    <SelectItem key={h} value={h} className="text-xs">
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 테이블 */}
      {parsedRows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              총 {parsedRows.length}개 중 {selectedCount}개 선택됨
              {parsedRows.length > PREVIEW_LIMIT && (
                <span className="text-muted-foreground ml-1">
                  (미리보기: {PREVIEW_LIMIT}개)
                </span>
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleAll}
            >
              {allSelected ? "전체 해제" : "전체 선택"}
            </Button>
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left border-b w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-2 text-left border-b">IP 주소</th>
                  <th className="px-3 py-2 text-left border-b">상태</th>
                  <th className="px-3 py-2 text-left border-b">설명</th>
                  <th className="px-3 py-2 text-left border-b">할당 대상</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr
                    key={row.rowIndex}
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      row.selected ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                    onClick={() => toggleRow(row.rowIndex)}
                  >
                    <td className="px-3 py-2 border-b">
                      <Checkbox
                        checked={row.selected}
                        onCheckedChange={() => toggleRow(row.rowIndex)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-2 border-b font-mono">
                      {row.ip_address}
                    </td>
                    <td className="px-3 py-2 border-b">
                      {row.status}
                    </td>
                    <td className="px-3 py-2 border-b truncate max-w-[150px]">
                      {row.description || "-"}
                    </td>
                    <td className="px-3 py-2 border-b truncate max-w-[150px]">
                      {row.allocated_to || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedRows.length > PREVIEW_LIMIT && (
            <p className="text-xs text-muted-foreground text-center">
              ... 외 {parsedRows.length - PREVIEW_LIMIT}개 항목
            </p>
          )}
        </div>
      )}

      {csvHeaders.length === 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
          <p className="font-medium mb-2">CSV 파일 형식:</p>
          <p className="text-xs text-muted-foreground mb-2">
            헤더가 있는 CSV 파일을 업로드하세요. 열 이름은 자유롭게 지정할 수 있습니다.
          </p>
          <code className="text-xs block bg-gray-100 dark:bg-gray-900 p-2 rounded">
            IP,상태,설명,담당자
            <br />
            10.161.48.100,allocated,웹서버,홍길동
          </code>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isLoading || selectedCount === 0}>
        {isLoading ? "업로드 중..." : `선택한 ${selectedCount}개 IP 등록`}
      </Button>
    </form>
  );
}
