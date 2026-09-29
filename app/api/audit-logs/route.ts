import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toKoreanError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ipAddressId = searchParams.get("ip_address_id");
    const limit = parseInt(searchParams.get("limit") || "50");

    let query = supabase
      .from("audit_logs")
      .select(
        `
        *,
        user:profiles(id, email),
        ip_address:ip_addresses(id, ip_address)
      `
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (ipAddressId) {
      query = query.eq("ip_address_id", ipAddressId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: toKoreanError(error) }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
