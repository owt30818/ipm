"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);

        // Check for chunk load error
        if (error.name === "ChunkLoadError" || error.message.includes("Loading chunk") || error.message.includes("Failed to load chunk")) {
            // Automatically reload the page to fetch the newly deployed chunks
            window.location.reload();
        }
    }, [error]);

    // If it's a chunk error, it will reload automatically, but we show a message just in case
    const isChunkError = error.name === "ChunkLoadError" || error.message.includes("Loading chunk") || error.message.includes("Failed to load chunk");

    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4">
            <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold tracking-tight text-red-600">
                    문제가 발생했습니다
                </h2>
                <p className="text-muted-foreground max-w-[500px]">
                    {isChunkError
                        ? "새로운 기능 업데이트가 배포되었습니다. 페이지를 새로고침합니다..."
                        : "페이지를 불러오는 중 예상치 못한 오류가 발생했습니다."}
                </p>
            </div>

            {!isChunkError && (
                <Button onClick={() => reset()} variant="outline">
                    다시 시도
                </Button>
            )}
        </div>
    );
}
