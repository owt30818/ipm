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

- **CSV 백업:** 정보 페이지(`/about`) → DB 백업 카드 (관리자만) → 서브넷 / IP 주소 / 감사 로그 CSV 다운로드
  - IP 주소 CSV는 IP 목록 내보내기(필터 없음)와 같은 형식이라, 서브넷을 만든 뒤 IP 할당 → CSV 업로드로 다시 등록 가능
  - 로그인 계정(비밀번호)은 포함되지 않음: 복구 시 사용자 관리에서 다시 생성
- **일시 중지 방지:** 앱 서버가 시작 1분 후, 이후 24시간마다 Supabase에 조회 1회 (`instrumentation.ts` → `lib/keep-alive.ts`). 마지막 성공 시각이 같은 카드에 표시되며 서버 재시작 시 초기화됨
- 별도 컨테이너나 폴더 마운트 불필요

## 📖 문서

상세 기술 문서는 `TECHNICAL_DOCS.md`를 참조하세요.

## 📄 라이선스

Private - All Rights Reserved

---

**Version: 1.0.0** | Built with ❤️
