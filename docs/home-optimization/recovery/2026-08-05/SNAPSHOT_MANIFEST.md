# 골프조인 현재 정상 로컬 소스 복구 스냅샷

| 구분 | 값 |
|---|---|
| 생성일 | 2026-08-05 (Asia/Seoul) |
| 계획 단계 | 0단계 — 기준선 고정과 복구 준비 |
| 압축파일 | `golfjoin-known-good-local-20260805.zip` |
| 압축파일 크기 | 4,523,117 bytes |
| 압축파일 SHA-256 | `9CB06C9FAB9C0F6A30698DA6BC33E9C82CE78E4F5116B801050C2190E0C39825` |
| 압축 항목 수 | 34개 |
| `node_modules` 포함 여부 | 미포함 |
| 생성 전 검사 | `index.js`, `alimtalk.js` 구문 검사 통과, 전체 테스트 36/36 통과 |

## 포함 범위

- `golfjoin_main.html`
- `golfjoin_admin_dashboard.html`
- `server/google-sheet-proxy-function`의 소스, 테스트, package 파일, PDF용 assets
- `doc/golfjoin-deploy-commands.md`

`node_modules`는 운영 배포 소스가 아니므로 제외했다. 복구 환경에서는 `package-lock.json`을 기준으로 의존성을 설치한다.

## 핵심 파일 해시

| 파일 | SHA-256 |
|---|---|
| `golfjoin_main.html` | `A6AA39033861F0EE0B192A6AE008D84C4A5499D68C2C7DC8E073AF9839502C75` |
| `golfjoin_admin_dashboard.html` | `7338805FBF0EC76160BBEA049B1ED492D732A0883ED2F22CF8F0C92FA9E42962` |
| `server/google-sheet-proxy-function/index.js` | `F4ACFD372EE8CCB387E784385BF3620082D74D1599B1D34D8EC186D43E3F0C57` |
| `server/google-sheet-proxy-function/alimtalk.js` | `47D379BAC386A05240741C9A2F778AEEE82FCCB59194860867A41C8D2AFF3ED9` |
| `server/google-sheet-proxy-function/home-products.js` | `AEF19B38034DC6565D0B2479E813B4A5E2DCD56EA067BC583CEF21FDD5B75FA9` |
| `server/google-sheet-proxy-function/package.json` | `A198460B989BC87D27A59822C978D16305C2A7B8170CF44C83CEECAE05A79390` |
| `server/google-sheet-proxy-function/package-lock.json` | `9747474300766DAD4B352896932E98F5F4324CDAA1499F41E8084D24C2DFB929` |

## 중요한 제한

이 스냅샷은 현재 로컬 작업트리의 정상 동작 후보를 보존한 것이다. `golfjoin_main.html`에는 사용자가 완료한 미커밋 UI 변경이 포함돼 있다. 운영 게시판 소스 원문과 바이트 단위로 같다는 확인은 아직 하지 않았으므로, 운영 복구 전에 게시판 원문을 별도로 보존하고 화면 검증을 수행해야 한다.

Cloud Function 환경변수 파일과 인증정보는 보안상 포함하지 않았다. 서버 복구 시 운영 환경의 기존 env yaml을 사용하되 값을 출력하거나 이 문서에 복사하지 않는다.

## 사용 순서

1. 압축파일 SHA-256을 위 값과 비교한다.
2. 새 폴더에 압축을 풀고 핵심 파일 해시를 비교한다.
3. 서버 폴더에서 `node --check index.js`, `node --check alimtalk.js`, `npm test`를 실행한다.
4. 메인 HTML 문제라면 현재 게시판 원문을 보존한 후 `golfjoin_main.html`을 등록한다.
5. 서버 문제라면 기존 운영 환경변수를 유지한 채 실행서의 배포 명령으로 복구한다.
6. 비로그인·로그인 메인, 내예약, 상품상세, 생성·참여 정합성을 순서대로 검증한다.

