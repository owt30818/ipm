// Role rules mirroring the RLS policies in supabase/migrations/001_initial_schema.sql.
// The UI hides what a role cannot do; the database (RLS) remains the real enforcement.

export type UserRole = "admin" | "sub_admin" | "user";

export const roleLabels: Record<UserRole, string> = {
  admin: "관리자",
  sub_admin: "부관리자",
  user: "사용자",
};

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "sub_admin" || value === "user";
}

// Register / edit / allocate IPs, register and edit subnets
export function canManage(role?: UserRole | null): boolean {
  return role === "admin" || role === "sub_admin";
}

// Delete IPs and subnets
export function canDelete(role?: UserRole | null): boolean {
  return role === "admin";
}

export const NO_PERMISSION_MANAGE = "권한이 없습니다. 관리자 또는 부관리자만 사용할 수 있습니다.";
export const NO_PERMISSION_DELETE = "권한이 없습니다. 관리자만 삭제할 수 있습니다.";
