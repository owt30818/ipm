---
name: security-update
description: IPAM 앱(이 저장소)의 Node.js 기반 이미지, npm 패키지, 배포 이미지(Trivy)를 점검하고 같은 메이저 안의 보안 패치를 적용해 push까지 한다. "보안 업데이트", "취약점 점검", "Node 보안 릴리스", "npm audit", "패키지 업데이트 점검" 같은 요청에 사용. 메이저 업그레이드는 하지 않고 알리기만 한다.
---

# IPAM 보안 업데이트

## 원칙

- **기준은 "지금 메이저 안의 최신 패치"다.** Node 22.x, next 15.5.x처럼 같은 메이저 안에서만 올린다.
  메이저 업그레이드(next 16, tailwind 4, Node 24 등)와 `npm audit fix --force`는 하지 않고, 마지막 요약에 "따로 계획할 일"로 알린다.
- **진행 여부를 묻지 않는다.** 사용자가 직접 실행하는 스킬이므로 실행 자체가 승인이다. 점검 표를 보여준 뒤 적용, 검증, push까지 진행한다.
  push하면 GHCR 이미지만 새로 빌드되고, 운영(TrueNAS)에는 사용자가 이미지를 다시 받아야 반영되므로 push 자체로 운영이 바뀌지는 않는다.
- **멈추고 보고하는 경우:**
  1. 적용할 것이 없을 때 (점검 결과만 보고하고 끝낸다)
  2. 타입 에러 수가 기준(아래)보다 늘었거나, lint 에러, 빌드 실패가 났을 때. 커밋하지 않고 원인을 알린다.
  3. 패치만으로는 해결되지 않는 CRITICAL이 운영 이미지(Trivy의 `app` 또는 `os`)에 있을 때
- 이 서버에는 node, npm, gh가 없다. npm은 Node 컨테이너에서, CI 상태는 공개 GitHub API로 확인한다.

## 1. 점검 (읽기 전용)

```bash
.claude/skills/security-update/check.sh
```

20초쯤 걸린다. 확인하는 항목은 다음과 같다.
1. **Node.js:** `Dockerfile`에 고정한 버전과 같은 메이저의 새 릴리스(`SECURITY` 표시). 표시가 있으면 https://nodejs.org/en/blog/vulnerability/ 의 해당 공지에서 CVE 목록을 읽는다.
2. **npm audit / outdated:** lockfile 기준이다. `deps`는 `package.json`의 dependencies, `dev`는 devDependencies를 뜻한다.
   tailwindcss처럼 dependencies에 있어도 빌드할 때만 쓰는 패키지가 있으므로, **운영에서 실행되는지는 3번 Trivy로 판단한다.**
3. **Trivy:** 배포된 `ghcr.io/owt30818/ipm:latest`를 스캔한다. 위치는 `os`(Alpine 패키지), `app`(standalone에 포함된 앱 패키지), `image npm`(기반 이미지에 들어 있는 npm 자체) 중 하나로 나온다.
4. **기타:** cloudflared, 백업 스택 postgres, GitHub Actions 버전. 자동으로 판단하지 않으므로 목록만 보여 준다.

결과는 계층별 표(현재 → 패치 버전, 등급, 운영 영향, 조치)로 먼저 보여 준다.

### 판단 기준

| 구분 | 조치 |
|------|------|
| Node 새 패치 (특히 `SECURITY`) | `Dockerfile`의 `FROM node:X.Y.Z-alpine` 3곳을 올린다. Docker Hub에 `X.Y.Z-alpine` 태그가 올라왔는지 먼저 확인한다 |
| npm 같은 메이저 안의 업데이트 / `npm audit fix`로 해결 | 적용 |
| `(MAJOR)`로만 해결 / `no fix` | 적용하지 않음. 요약에 알림 |
| Trivy `os` | 기반 이미지를 다시 빌드하면 대부분 해결된다 (Node 태그를 올리거나 같은 태그로 다시 빌드) |
| Trivy `image npm` | 앱이 실행하지 않는 코드다(CMD는 `node server.js`). 위험이 낮으므로 알리기만 한다. 없애려면 runner 단계에서 npm을 지우는 방법이 있다(아래 "알려진 항목") |

## 2. 적용

Node 태그를 올릴 때:
```bash
sed -i 's/^FROM node:[0-9.]*-alpine AS/FROM node:<새 버전>-alpine AS/' Dockerfile && grep -n '^FROM' Dockerfile
```

npm 패키지를 업데이트할 때 (`package.json`의 버전 범위는 바뀌지 않고 lockfile만 바뀐다):
```bash
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app node:<고정 버전>-alpine \
  sh -c 'npm ci --no-fund && npm update --no-fund && npm audit fix --no-fund' 2>&1 | grep -v 'npm notice' | tail -20
```
이 명령이 저장소에 `node_modules/`를 만들지만 gitignore 대상이다.

## 3. 검증

```bash
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -e NEXT_TELEMETRY_DISABLED=1 -v "$PWD":/app -w /app node:<고정 버전>-alpine sh -c '
npx tsc --noEmit 2>&1 | grep -c "error TS"; npm run lint 2>&1 | tail -6; npm run build 2>&1 | tail -25'
```

- **타입 에러 기준은 12개다** (2026-10-22, `723ebbd` 기준. Supabase 타입이 `never`로 추론되는 문제와 `Date(string | null)`). 빌드 설정이 타입 에러를 무시하므로 개수만 비교한다.
  개수가 다르면 업데이트 전 코드로 비교한다: `git worktree add --detach <scratchpad>/base HEAD`에서 `npm ci` 후 `tsc`를 돌리고, 끝나면 `git worktree remove --force`로 지운다.
  타입 에러를 고쳐서 기준이 바뀌면 이 숫자도 함께 고친다.
- lint는 경고 2개(`audit-logs/route.ts` 미사용 변수, `turnstile.tsx` useEffect 의존성)가 원래 나온다. 에러만 문제로 본다.
- 빌드는 마지막에 Route 표가 나오면 성공이다.

## 4. 커밋과 배포

- 이 서버에는 git 사용자 정보가 설정되어 있지 않다. 저장소의 기존 작성자로 커밋한다:
  `git -c user.name=owt30818 -c user.email=owt30818@gmail.com commit ...`
- Node 태그 변경과 npm 업데이트는 커밋을 나눈다. 메시지에는 바뀐 버전과 해결한 CVE/GHSA를 적는다.
- `git push origin main` 뒤 CI를 확인한다. GitHub API 응답은 몇 분씩 캐시될 수 있으니 `updated_at`도 함께 본다:
  ```bash
  curl -s "https://api.github.com/repos/owt30818/ipm/actions/runs?head_sha=$(git rev-parse HEAD)" \
    | python3 -c "import sys,json;r=json.load(sys.stdin)['workflow_runs'];print(r[0]['status'],r[0]['conclusion'],r[0]['updated_at'],r[0]['html_url']) if r else print('none yet')"
  ```
  기다릴 때는 이 확인을 백그라운드 루프로 돌린다. 빌드는 보통 2~4분 걸린다.

## 5. 마무리 요약

- 계층별 표로 보고한다: 이전 → 이후 버전, 해결한 취약점, 커밋, CI 결과
- **남은 항목:** 메이저 업그레이드가 필요한 것, `no fix`, `image npm`. 각각 운영 영향을 한 줄로 적는다.
- **사용자가 할 일:** TrueNAS에서 IPAM 앱 이미지를 다시 받아 재시작하고, `/about`에서 Node 버전을 확인한다.
- Node 메이저의 지원 종료가 1년 안으로 다가오면 다음 LTS로 옮길 계획을 알린다 (https://github.com/nodejs/Release#release-schedule). Node 22는 2027-04-30에 지원이 끝난다.

## 알려진 항목 (2026-10-22 기준)

- `postcss 8.4.31` (next 안에 들어 있음): 운영 이미지에 들어 있지만 CSS를 처리할 때만 쓰인다. next 16으로 올려야 해결된다.
- braces, micromatch, chokidar, postcss-selector-parser: tailwind 3과 eslint-config-next에 딸린 빌드 도구라 운영 이미지에는 없다. tailwind 4로 올려야 해결된다.
- `image npm`(brace-expansion, pacote, sigstore 등): `node:22-alpine`에 들어 있는 npm의 의존성이다. 없애려면 `Dockerfile` runner 단계에
  `RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn* /usr/local/bin/yarn*`를 넣는다. 사용자가 원할 때만 적용한다.
