// Turns Postgres / PostgREST / Supabase Auth / network errors into Korean user-facing messages.
// Raw English database text is never shown to the user; unknown errors fall back to a generic message.

interface ErrorLike {
  code?: string;
  message?: string;
  details?: string;
  name?: string;
  status?: number;
}

const HANGUL = /[가-힣]/;

const MSG = {
  generic: "오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  network: "서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.",
  forbidden: "권한이 없습니다.",
  unauthenticated: "로그인이 필요합니다. 다시 로그인해주세요.",
  sessionExpired: "세션이 만료되었습니다. 다시 로그인해주세요.",
  rateLimit: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  setup: "서버 설정 오류: 필요한 데이터베이스 함수를 찾을 수 없습니다. 관리자에게 문의해주세요.",
};

function normalize(err: unknown): ErrorLike | null {
  if (!err) return null;
  if (typeof err === "string") return { message: err };
  if (typeof err === "object") {
    const e = err as Record<string, unknown>;
    return {
      code: e.code != null ? String(e.code) : undefined,
      message: typeof e.message === "string" ? e.message : undefined,
      details: typeof e.details === "string" ? e.details : undefined,
      name: typeof e.name === "string" ? e.name : undefined,
      status: typeof e.status === "number" ? e.status : undefined,
    };
  }
  return null;
}

// Supabase Auth: error.code (snake_case)
const AUTH_BY_CODE: Record<string, string> = {
  invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  email_not_confirmed: "이메일 인증이 완료되지 않았습니다.",
  user_not_found: "사용자를 찾을 수 없습니다.",
  user_already_exists: "이미 등록된 이메일입니다.",
  email_exists: "이미 등록된 이메일입니다.",
  weak_password: "비밀번호가 너무 약합니다. 더 길고 복잡한 비밀번호를 사용해주세요.",
  same_password: "새 비밀번호는 현재 비밀번호와 달라야 합니다.",
  over_request_rate_limit: MSG.rateLimit,
  over_email_send_rate_limit: MSG.rateLimit,
  session_expired: MSG.sessionExpired,
  session_not_found: MSG.sessionExpired,
  refresh_token_not_found: MSG.sessionExpired,
  bad_jwt: MSG.sessionExpired,
  signup_disabled: "회원가입이 비활성화되어 있습니다.",
  validation_failed: "입력값이 올바르지 않습니다.",
  captcha_failed: "보안 검증(CAPTCHA)에 실패했습니다.",
  not_admin: MSG.forbidden,
  no_authorization: MSG.forbidden,
};

// Supabase Auth: message text (older errors carry no code)
const AUTH_BY_MESSAGE: [RegExp, string][] = [
  [/invalid login credentials/i, AUTH_BY_CODE.invalid_credentials],
  [/email not confirmed/i, AUTH_BY_CODE.email_not_confirmed],
  [/already (been )?registered|already exists/i, AUTH_BY_CODE.email_exists],
  [/should be different from the old password/i, AUTH_BY_CODE.same_password],
  [/known to be weak|easy to guess|has been (found|leaked)/i, AUTH_BY_CODE.weak_password],
  [/password should be at least (\d+)/i, "비밀번호가 너무 짧습니다."],
  [/auth session missing|jwt expired/i, MSG.sessionExpired],
  [/rate limit/i, MSG.rateLimit],
];

// "192.168.1.5/24" -> "192.168.1.0/24"
function networkOf(cidr: string): string | null {
  const m = cidr.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/);
  if (!m) return null;
  const prefix = Number(m[5]);
  const octets = m.slice(1, 5).map(Number);
  if (prefix < 0 || prefix > 32 || octets.some((o) => o > 255)) return null;
  const ip = (((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const net = (ip & mask) >>> 0;
  return `${net >>> 24}.${(net >>> 16) & 255}.${(net >>> 8) & 255}.${net & 255}/${prefix}`;
}

function fromDatabase(code: string, message: string, details: string): string | null {
  const text = `${message} ${details}`;

  // Errors raised by our own SQL (migrations 009/010)
  const ip = message.match(/IP address (\S+) is outside subnet (\S+)/);
  if (ip) return `IP 주소 ${ip[1]}은(는) 서브넷 ${ip[2]} 범위를 벗어납니다.`;
  if (/Not authenticated/.test(message)) return MSG.unauthenticated;
  if (/Insufficient privileges/.test(message)) {
    return "권한이 없습니다. 관리자 또는 부관리자만 사용할 수 있습니다.";
  }
  if (/Quantity must be positive/.test(message)) return "수량은 1 이상이어야 합니다.";
  const max = message.match(/Quantity must not exceed (\d+)/);
  if (max) return `한 번에 최대 ${max[1]}개까지 할당할 수 있습니다.`;
  if (/Subnet not found/.test(message)) return "서브넷을 찾을 수 없습니다.";
  if (/Insufficient contiguous IP space/.test(message)) {
    return "연속된 IP 공간이 부족합니다. 수량을 줄이거나 다른 서브넷을 선택해주세요.";
  }

  // Constraint violations (RLS hides key values from details, so match on constraint names)
  if (code === "23505" || /duplicate key value/.test(message)) {
    if (/ip_addresses_ip_address_key/.test(text)) {
      const dup = details.match(/\(ip_address\)=\(([^)]+)\)/);
      return dup
        ? `이미 등록된 IP 주소입니다: ${dup[1].replace(/\/32$/, "")}`
        : "이미 등록된 IP 주소입니다.";
    }
    if (/subnets_cidr_key/.test(text)) return "이미 등록된 서브넷(CIDR)입니다.";
    return "이미 존재하는 항목입니다.";
  }
  if (code === "23P01" || /exclusion constraint/.test(message)) {
    const pair = details.match(/\(cidr\)=\(([^)]+)\) conflicts with existing key \(cidr\)=\(([^)]+)\)/);
    return pair
      ? `서브넷 ${pair[1]}이(가) 기존 서브넷 ${pair[2]}과(와) 주소 범위가 겹칩니다.`
      : "다른 서브넷과 주소 범위가 겹칩니다. 등록된 서브넷을 확인해주세요.";
  }
  if (code === "23514" || /violates check constraint/.test(message)) {
    if (/ip_addresses_status_check/.test(text)) return "올바르지 않은 상태 값입니다.";
    if (/profiles_role_check/.test(text)) return "올바르지 않은 역할입니다.";
    return "허용되지 않는 값입니다.";
  }
  if (code === "23503" || /violates foreign key constraint/.test(message)) {
    if (/update or delete on table/.test(message)) return "다른 데이터에서 사용 중이라 삭제할 수 없습니다.";
    return "연결된 데이터가 올바르지 않습니다.";
  }
  if (code === "23502" || /violates not-null constraint/.test(message)) return "필수 항목이 비어 있습니다.";

  // Malformed input
  if (/bits set to right of mask/.test(text)) {
    const bad = message.match(/invalid cidr value: "([^"]+)"/)?.[1];
    const fixed = bad ? networkOf(bad) : null;
    return fixed
      ? `CIDR에 호스트 비트가 포함되어 있습니다. 네트워크 주소로 입력해주세요 (${bad} → ${fixed}).`
      : "CIDR에 호스트 비트가 포함되어 있습니다. 네트워크 주소로 입력해주세요.";
  }
  if (/type inet/.test(message)) return "올바른 IP 주소 형식이 아닙니다.";
  if (/type cidr|invalid cidr value/.test(message)) return "올바른 CIDR 형식이 아닙니다 (예: 192.168.1.0/24).";
  if (/type uuid/.test(message)) return "잘못된 ID 형식입니다.";
  if (code === "22P02" || code === "22P03") return "입력값의 형식이 올바르지 않습니다.";
  if (code === "22001") return "입력값이 너무 깁니다.";
  if (code === "22003") return "숫자 값이 허용 범위를 벗어났습니다.";

  // Permissions and API layer
  if (code === "42501" || /row-level security|permission denied/.test(message)) return MSG.forbidden;
  if (code === "PGRST116") return "대상을 찾을 수 없거나 접근 권한이 없습니다.";
  if (code === "PGRST301" || code === "PGRST303" || /JWT expired/.test(message)) return MSG.sessionExpired;
  if (code === "PGRST202" || code === "42883") return MSG.setup;
  if (code === "57014") return "요청 시간이 초과되었습니다. 다시 시도해주세요.";
  if (code === "40001" || code === "40P01") return "다른 작업과 충돌했습니다. 잠시 후 다시 시도해주세요.";

  return null;
}

export function toKoreanError(err: unknown, fallback: string = MSG.generic): string {
  const e = normalize(err);
  if (!e) return fallback;

  const message = e.message ?? "";
  const code = e.code ?? "";

  const mapped =
    AUTH_BY_CODE[code] ??
    fromDatabase(code, message, e.details ?? "") ??
    AUTH_BY_MESSAGE.find(([pattern]) => pattern.test(message))?.[1];
  if (mapped) return mapped;

  // Messages produced by our own code are already Korean
  if (HANGUL.test(message)) return message;

  if (/fetch failed|failed to fetch|networkerror|load failed|econnrefused|enotfound|etimedout/i.test(message)) {
    return MSG.network;
  }
  if (e.status === 429) return MSG.rateLimit;
  if (e.status && e.status >= 500) return "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";

  if (typeof console !== "undefined") console.warn("[unmapped error]", err);
  return fallback;
}
