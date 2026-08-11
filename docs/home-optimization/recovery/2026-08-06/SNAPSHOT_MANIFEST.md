# 골프조인 `8A853...` 현재 운영 정상 소스 복구 스냅샷

| 구분 | 값 |
|---|---|
| 생성일 | 2026-08-06 (Asia/Seoul) |
| 계획 단계 | 0단계 — 기준선 고정과 복구 준비 |
| 운영 HTML 경계 | `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC` |
| 압축파일 | `golfjoin-known-good-local-20260806-8a853.zip` |
| 압축파일 크기 | 4,522,026 bytes |
| 압축파일 SHA-256 | `F87AA9FCBC64E2691FB6AD3F264AAE40DD970364A78C0FA815426831C74125E6` |
| 압축 파일 수 | 27개 |
| `node_modules` 포함 여부 | 미포함 |
| 생성 전 검사 | `index.js`, `alimtalk.js` 구문 검사 통과, 서버 테스트 36/36 통과 |

## 1. 기준 경계

- [x] 사용자가 `8A853...` HTML의 운영 배포 완료를 확인했다.
- [x] 같은 해시에서 PC/MO·로그인/비로그인 Cold/Warm 기준선을 측정했다.
- [x] 스냅샷 생성 직전 HTML 해시를 다시 확인했다.
- [x] 이전 `A6AA...` 패키지는 역사적 복구본으로만 보존하고 현재 복구 기본값으로 사용하지 않는다.

## 2. 포함 범위

- `golfjoin_main.html`
- `golfjoin_admin_dashboard.html`
- `server/google-sheet-proxy-function`의 소스·테스트·package 파일·PDF assets
- `doc/golfjoin-deploy-commands.md`

Cloud Function 환경변수 파일, 인증정보, `node_modules`는 포함하지 않았다. 복구 시 운영 환경의 기존 env yaml을 사용하며 값은 출력하거나 문서에 복사하지 않는다.

## 3. 핵심 파일 해시

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| `golfjoin_main.html` | 2,731,639 bytes | `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC` |
| `golfjoin_admin_dashboard.html` | 504,455 bytes | `7338805FBF0EC76160BBEA049B1ED492D732A0883ED2F22CF8F0C92FA9E42962` |
| `server/google-sheet-proxy-function/index.js` | 434,225 bytes | `F4ACFD372EE8CCB387E784385BF3620082D74D1599B1D34D8EC186D43E3F0C57` |
| `server/google-sheet-proxy-function/alimtalk.js` | 4,106 bytes | `47D379BAC386A05240741C9A2F778AEEE82FCCB59194860867A41C8D2AFF3ED9` |
| `server/google-sheet-proxy-function/home-products.js` | 8,744 bytes | `AEF19B38034DC6565D0B2479E813B4A5E2DCD56EA067BC583CEF21FDD5B75FA9` |
| `server/google-sheet-proxy-function/package.json` | 313 bytes | `A198460B989BC87D27A59822C978D16305C2A7B8170CF44C83CEECAE05A79390` |
| `server/google-sheet-proxy-function/package-lock.json` | 65,100 bytes | `9747474300766DAD4B352896932E98F5F4324CDAA1499F41E8084D24C2DFB929` |

## 4. 사용 순서

1. ZIP SHA-256이 `F87AA9...`인지 확인한다.
2. 기존 작업 폴더를 덮어쓰지 말고 새 격리 폴더에 압축을 푼다.
3. 위 핵심 파일 7개 해시를 비교한다.
4. 서버 폴더에서 `node --check index.js`, `node --check alimtalk.js`, `npm test`를 실행한다.
5. HTML 문제라면 현재 게시판 원문을 먼저 별도 보존한 후 `golfjoin_main.html`만 등록한다.
6. 서버 문제라면 기존 운영 환경변수를 유지하고 정상 서버 소스만 배포한다.
7. 비로그인·로그인·모바일·내예약·상품상세·생성·참여 정합성을 확인한다.

## 5. 제한

이 패키지는 현재 로컬과 사용자가 배포 완료한 HTML 경계를 복구 가능한 형태로 고정한 것이다. 실제 게시판 소스보기 입력·저장·원복 시간과 Cloud Function 이전 revision 전환 시간은 운영에 노출되지 않는 스테이징에서 별도로 검증해야 한다.

