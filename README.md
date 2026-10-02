# IPM SaaS

IP 주소 관리 시스템 (IP Address Management SaaS)

![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![License](https://img.shields.io/badge/License-Private-red)

## 📋 개요

IPM SaaS는 기업 환경에서 IP 주소를 효율적으로 관리하기 위한 웹 애플리케이션입니다.

### 주요 기능

- 🔐 **사용자 인증** - Supabase Auth + Cloudflare Turnstile CAPTCHA
- 🌐 **서브넷 관리** - CIDR 기반 서브넷 생성 및 관리
- 📍 **IP 주소 할당** - 연속 IP 블록 자동 할당
- 📊 **대시보드** - IP 사용 현황 시각화
- 📜 **감사 로그** - 모든 변경 이력 추적
- 👥 **역할 기반 접근 제어** - Admin, Sub-Admin, User 권한 분리

## 🛠 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | Supabase, PostgreSQL 17, PostgREST |
| Auth | Supabase Auth, Cloudflare Turnstile |
| Infra | Docker, Cloudflare Tunnel, Systemd |

## 🚀 설치 및 실행

### 사전 요구사항

- Node.js 20+
- Docker
- Supabase CLI

### 설치

```bash
# 의존성 설치
npm install

# Supabase 시작
npx supabase start

# 개발 서버 실행
npm run dev
```

### 프로덕션 빌드

```bash
# 빌드
npm run build

# Standalone 배포용 정적 파일 복사
cp -r .next/static .next/standalone/.next/static
mkdir -p .next/standalone/public

# 서버 실행
export $(grep -v '^#' .env.local | xargs) && node .next/standalone/server.js
```

## 📁 프로젝트 구조

```
IPM/
├── app/                  # Next.js App Router
│   ├── (auth)/           # 인증 페이지
│   ├── (main)/           # 메인 애플리케이션
│   ├── actions/          # Server Actions
│   └── api/              # API Routes
├── components/           # React 컴포넌트
├── lib/                  # 유틸리티
├── supabase/             # Supabase 설정 & 마이그레이션
└── ...
```

## 🔧 환경 변수

`.env.local` 파일 생성:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
```

## 💾 DB 백업

`docker-compose.yml`의 `db-backup` 서비스가 Supabase Cloud DB를 매일 `pg_dump`합니다 (`public` + `auth` 스키마, custom 포맷).
매일 접속하므로 무료 티어의 7일 미사용 일시 중지도 방지됩니다.

- **접속 정보:** 대시보드 → Connect → **Session pooler** 의 host / user(`postgres.<project-ref>`) / DB 비밀번호를 `BACKUP_PG*` 변수에 입력 (`.env.example` 참고)
- **저장 위치:** `BACKUP_DIR` (TrueNAS에서는 데이터셋 경로, 예: `/mnt/tank/apps/ipam-backups` → 스냅샷/복제로 이중 보관)
- **보관 기간:** `BACKUP_KEEP_DAYS` (기본 14일), 파일명 `ipam-YYYYMMDD-HHMMSSZ.dump` (UTC)
- **확인:** `docker compose logs db-backup` → `[backup] OK` / `[backup] FAILED`
- **정보 페이지(`/about`):** 마지막 백업 시각과 상태(48시간 넘게 없으면 "지연")는 모두에게, 백업 목록과 다운로드는 관리자에게만 표시. 앱 컨테이너는 같은 폴더를 `/backups`에 읽기 전용으로 마운트

덤프에는 비밀번호 해시(`auth.users`)가 포함되어 있어 파일 권한이 `600`이고, 앱의 `nextjs` 사용자(uid 1001)만 읽을 수 있습니다.

### 복구

```bash
# 덤프 내용 확인
pg_restore -l ipam-20260101-000000Z.dump

# 새 Supabase 프로젝트에 복구: 마이그레이션으로 스키마를 만든 뒤 데이터만 넣기
PGOPTIONS='-c session_replication_role=replica' \
pg_restore --data-only -n auth -n public \
  -d "postgresql://postgres.<ref>:<pw>@<pooler-host>:5432/postgres" ipam-20260101-000000Z.dump
```

`session_replication_role=replica`는 복구 중 트리거(감사 로그 중복 기록, FK 순서 검사)를 끕니다 (Supabase 복구 가이드와 같은 방식).
실제 Supabase 프로젝트로의 복구는 아직 검증하지 않았으니, 처음 한 번은 빈 테스트 프로젝트에 복구해 보세요.

## 📖 문서

상세 기술 문서는 `TECHNICAL_DOCS.md`를 참조하세요.

## 📄 라이선스

Private - All Rights Reserved

---

**Version: 1.0.0** | Built with ❤️
