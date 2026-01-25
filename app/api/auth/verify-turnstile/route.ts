import { NextRequest, NextResponse } from "next/server";

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    // Local Development Bypass
    if (process.env.NODE_ENV === "development" && (token === "local-bypass" || !token)) {
      return NextResponse.json({ success: true });
    }

    if (!token) {
      return NextResponse.json(
        { error: "토큰이 필요합니다." },
        { status: 400 }
      );
    }

    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
      console.error("TURNSTILE_SECRET_KEY is not configured");
      return NextResponse.json(
        { error: "서버 구성 오류" },
        { status: 500 }
      );
    }

    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
    if (ip) {
      formData.append("remoteip", ip);
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      }
    );

    const data: TurnstileResponse = await response.json();

    if (!data.success) {
      console.error("Turnstile verification failed:", data["error-codes"]);
      return NextResponse.json(
        { error: "보안 검증에 실패했습니다." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return NextResponse.json(
      { error: "검증 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
