import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { canDelete, canManage, NO_PERMISSION_DELETE, NO_PERMISSION_MANAGE } from "@/lib/roles";
import { toKoreanError } from "@/lib/errors";

const STATUSES = ["available", "allocated", "reserved", "deprecated"];

// Audit rows are written by the ip_addresses trigger (migration 010), not here.

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
      return NextResponse.json({ error: toKoreanError(error) }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionProfile();

    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    if (!canManage(session.role)) {
      return NextResponse.json({ error: NO_PERMISSION_MANAGE }, { status: 403 });
    }

    const body = await request.json();
    const { status, description, allocated_to } = body;

    if (status !== undefined && !STATUSES.includes(status)) {
      return NextResponse.json({ error: "올바르지 않은 상태 값입니다." }, { status: 400 });
    }

    const supabase = await createClient();

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
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: toKoreanError(updateError) }, { status: 400 });
    }

    if (!newData) {
      return NextResponse.json({ error: "IP를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(newData);
  } catch (error) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionProfile();

    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    if (!canDelete(session.role)) {
      return NextResponse.json({ error: NO_PERMISSION_DELETE }, { status: 403 });
    }

    const supabase = await createClient();

    // IP 삭제
    const { data: deleted, error: deleteError } = await supabase
      .from("ip_addresses")
      .delete()
      .eq("id", id)
      .select("id");

    if (deleteError) {
      return NextResponse.json({ error: toKoreanError(deleteError) }, { status: 400 });
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: "IP를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: toKoreanError(error) }, { status: 500 });
  }
}
