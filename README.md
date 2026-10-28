# IPM SaaS

IP 주소 관리 시스템 (IP Address Management SaaS)

![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![License](https://img.shields.io/badge/License-Private-red)

## 📋 개요

IPM SaaS는 기업 환경에서 IP 주소를 효율적으로 관리하기 위한 모바일 우선 웹 애플리케이션입니다.

### 주요 기능

- 🔐 **사용자 인증** - Supabase Auth + Cloudflare Turnstile CAPTCHA. 공개 가입은 없고, 관리자가 계정을 만듭니다
- 🌐 **서브넷 관리** - CIDR 기반 서브넷 등록·수정·삭제 (서로 겹치는 CIDR은 DB가 거부)
- 📍 **IP 주소 할당** - 단일 IP 등록(다음 가용 IP 자동 입력), 연속 IP 블록 자동 할당, CSV 대량 등록
- 🔎 **IP 목록** - 상태·서브넷·설명·IP 검색, 정렬, 자주 쓰는 검색 저장, 일괄 상태 변경·삭제, CSV 내보내기
- 📊 **대시보드** - 서브넷별 IP 사용 현황과 사용률
- 📜 **감사 로그** - IP 변경 이력을 DB 트리거가 자동 기록
- 👥 **역할 기반 접근 제어** - 관리자(admin) / 부관리자(sub_admin) / 사용자(user)
- ℹ️ **/about** - 앱 버전, 빌드 시각, 커밋, 설치된 패키지 버전

## 🛠 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Supabase, PostgreSQL 17, PostgREST |
| Auth | Supabase Auth, Cloudflare Turnstile |
| Infra | Docker, GitHub Actions → GHCR, TrueNAS, Cloudflare Tunnel |

## 🚀 설치 및 실행

### 사전 요구사항

- Node.js 20+ (Docker 이미지는 Node 22 사용)
- Docker
- Supabase CLI

### 설치

```bash
# 환경 변수 파일 준비 (아래 "환경 변수" 참고)
cp .env.example .env.local

# 의존성 설치
npm install

# 로컬 Supabase 시작 (supabase/migrations 가 자동 적용됨)
npx supabase start

# 개발 서버 실행 (http://localhost:3000)
npm run dev
```

### 프로덕션 빌드

```bash
# standalone 빌드 (배포에 필요한 정적 파일 복사까지 수행)
npm run build

# 서버 실행
export $(grep -v '^#' .env.local | xargs) && node .next/standalone/server.js
```

### 배포

`main` 브랜치에 push 하면 GitHub Actions(`.github/workflows/docker.yml`)가 `ghcr.io/owt30818/ipm:latest` 이미지를 빌드해 올리고, 운영 서버(TrueNAS)가 이 이미지를 받아 실행합니다. 이미지에는 설정이 들어 있지 않고 모든 값은 실행 시 환경 변수로 읽습니다.

> DB 마이그레이션은 자동으로 적용되지 않습니다. 새 `supabase/migrations/*.sql` 은 Supabase 프로젝트에 직접 적용하세요.

## 📁 프로젝트 구조

```
IPM/
├── app/                  # Next.js App Router
│   ├── (auth)/           # 로그인 페이지
│   ├── (main)/           # 대시보드, IP 목록, IP 할당, 설정, 정보
│   ├── actions/          # Server Actions
│   └── api/              # API Routes
├── components/           # React 컴포넌트
├── lib/                  # 유틸리티 (권한, CSV, 오류 메시지, Supabase 클라이언트 등)
├── supabase/             # Supabase 설정 & 마이그레이션 (001~013)
└── ...
```

## 🔧 환경 변수

`.env.local` (예시는 `.env.example`):

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TURNSTILE_SITE_KEY=your_turnstile_site_key
```

- 모두 **실행 시점**에 읽으므로 빌드할 때는 필요하지 않습니다.
- 로컬 개발에서는 예전 이름(`NEXT_PUBLIC_SUPABASE_URL` 등)도 그대로 동작합니다.
- `SUPABASE_SERVICE_ROLE_KEY` 는 서버에서만 사용하며 브라우저로 내보내지 않습니다.
- Turnstile 시크릿 키는 앱 환경 변수가 아니라 Supabase Dashboard → Authentication → Attack Protection 의 CAPTCHA(Turnstile) 설정에 넣습니다. 로그인 토큰은 Supabase Auth가 직접 검증합니다.

## 🗄 데이터베이스

- 스키마는 `supabase/migrations/` 의 SQL 로만 관리합니다.
- 2026-10-30부터 Supabase 가 `public` 의 새 테이블에 Data API 권한을 자동으로 주지 않으므로, 테이블을 만드는 마이그레이션은 같은 파일에서 `GRANT` 해야 합니다 (013 참고).
- 일일 DB 백업은 이 저장소와 별개로 홈서버의 `~/ipam-db-backup` 에서 수행합니다.

## 📖 문서

- [`USER_MANUAL.md`](USER_MANUAL.md) - 사용자 설명서
- [`CLAUDE.md`](CLAUDE.md) - 개발자 가이드 (아키텍처, 권한, DB 규칙, 배포)

앱 버전은 `/about` 페이지에서 확인할 수 있습니다.

## 📄 라이선스

Private - All Rights Reserved
