"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText, ipOnly } from "@/lib/clipboard";
import { useToast } from "@/hooks/use-toast";

interface CopyIpButtonProps {
  ip: string;
  className?: string;
}

// Copies just the IP address. It sits next to an IP inside clickable rows/cards, so the click
// must not bubble up (rows open the edit dialog, mobile cards open the drawer).
export function CopyIpButton({ ip, className }: CopyIpButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const address = ipOnly(ip);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const ok = await copyText(address);

    if (!ok) {
      toast({
        title: "복사하지 못했습니다",
        description: "브라우저에서 클립보드 접근이 허용되지 않았습니다.",
        variant: "destructive",
      });
      return;
    }

    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={copied ? "복사됨" : "IP 복사"}
      aria-label={copied ? `${address} 복사됨` : `${address} 복사`}
      data-copied={copied || undefined}
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        copied && "text-green-600 hover:text-green-600",
        className
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
