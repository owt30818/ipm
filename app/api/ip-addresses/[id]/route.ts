import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ip_addresses")
      .select(
        `
        *,
        subnet:subnets(id, cidr, name)
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { status, description, allocated_to } = body;

    // 존재 여부 확인 (감사 로그는 DB 트리거가 기록)
    const { error: fetchError } = await supabase
      .from("ip_addresses")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: "IP를 찾을 수 없습니다." }, { status: 404 });
    }

    // 업데이트 데이터 구성
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (description !== undefined) updateData.description = description;
    if (allocated_to !== undefined) updateData.allocated_to = allocated_to;

    if (status === "allocated" && allocated_to) {
      updateData.allocated_at = new Date().toISOString();
    } else if (status === "available") {
      updateData.allocated_to = null;
      updateData.allocated_at = null;
    }

    // IP 업데이트
    const { data: newData, error: updateError } = await supabase
      .from("ip_addresses")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json(newData);
  } catch (error) {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    // 존재 여부 확인 (감사 로그는 DB 트리거가 기록)
    const { error: fetchError } = await supabase
      .from("ip_addresses")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: "IP를 찾을 수 없습니다." }, { status: 404 });
    }

    // IP 삭제
    const { error: deleteError } = await supabase
      .from("ip_addresses")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
