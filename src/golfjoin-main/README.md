# 골프조인 메인 소스 구조

## 목적

현재 운영은 게시판에 `golfjoin_main.html` 한 파일을 넣는 방식이다. 이 배포 방식은 3단계에서 바꾸지 않는다. 개발 원본만 작은 책임 단위로 나누고, 배포 직전에는 다시 동일한 단일 HTML을 만든다.

초보자 관점에서는 큰 문서 한 장을 여러 장의 작업 문서로 나눠 편집한 뒤, 제출할 때 다시 한 장으로 합치는 과정이다.

## 안전 원칙

- 루트 `golfjoin_main.html`은 검증이 끝날 때까지 운영 기준 파일이다.
- 최초 소스 추출은 한 번만 허용한다. 이미 추출된 파일이 있으면 도구가 중단한다.
- 기본 빌드 결과는 `dist/golfjoin-main/golfjoin_main.html`에 생성한다.
- 빌드 도구는 작업공간 밖이나 루트 운영 파일을 자동으로 덮어쓰지 않는다.
- 첫 산출물은 현재 운영 기준과 바이트 수·SHA-256 hash가 모두 같아야 한다.
- 기능별 분리는 파일 순서를 보존한 기계적 이동부터 시작한다. 동작 변경과 구조 이동을 같은 작업에 섞지 않는다.

## 디렉터리 설계

```text
src/golfjoin-main/
├─ README.md
├─ source-manifest.json
└─ source/
   ├─ shell/
   │  ├─ 00-preamble.html
   │  └─ 40-suffix.html
   ├─ styles/
   │  └─ 10-main.css
   ├─ markup/
   │  └─ 20-main.html
   └─ scripts/
      ├─ boot/
      ├─ data/
      ├─ store/
      ├─ sections/
      ├─ detail/
      ├─ member/
      ├─ loading/
      ├─ performance/
      └─ legacy/
```

최초 추출에서는 JavaScript 전체를 `scripts/30-main.js` 하나로 보존한다. 바이트 동일성을 먼저 통과한 다음, 호출 순서와 전역 의존성을 기록하며 아래 책임으로 옮긴다.

| 책임 | 쉬운 설명 | 예시 |
|---|---|---|
| `boot` | 페이지 시작 순서를 관리 | 초기화, DOM 준비, 첫 렌더 예약 |
| `data` | 서버·GCS에서 데이터를 읽음 | fetch, 상품군, 홈 bootstrap |
| `store` | 화면이 함께 쓰는 상태를 보관 | 정규화, 캐시, 인덱스, 선택 상태 |
| `sections` | 메인 각 섹션을 그림 | MD PICK, 취향맞춤, 나의 모임, 내비게이션 |
| `detail` | 상품상세와 여행기간을 담당 | 상세 모달, 일정, 항공편, 캘린더 |
| `member` | 로그인 회원의 개인 기능 | 내예약, 찜, 참여자, 딥링크 |
| `loading` | 로딩과 스크롤 잠금을 관리 | 영역 로딩, 전역 로딩, 모달 잠금 |
| `performance` | 성능을 안전하게 측정 | mark, measure, 개인정보 마스킹 |
| `legacy` | 아직 안전하게 옮기지 못한 코드 | 전역 순서 의존 코드와 임시 호환부 |

## 명령

```powershell
npm.cmd run home:source:init
npm.cmd run home:source:migrate-diagnostics
npm.cmd run home:source:migrate-loading
npm.cmd run home:source:migrate-member-home-data
npm.cmd run home:source:migrate-member-reservations
npm.cmd run home:source:migrate-detail-sections-boot
npm.cmd run home:source:migrate-store
npm.cmd run home:source:inventory
npm.cmd run home:source:verify
npm.cmd run home:build
```

- `home:source:init`: 현재 루트 HTML을 최초 한 번 소스 조각으로 나눈다.
- `home:source:migrate-diagnostics`: 명확한 시작·종료 표식이 있는 성능 진단 블록을 첫 기능 모듈로 분리한다.
- `home:source:migrate-loading`: 전체 화면·영역 로딩과 모달 레이어의 연속 구간을 원래 순서 그대로 분리한다.
- `home:source:migrate-member-home-data`: 회원 인증·프로필·찜과 홈 bootstrap 데이터 구간을 원래 순서 그대로 분리한다.
- `home:source:migrate-member-reservations`: 내예약·참여자·마이메뉴·딥링크 구간을 공개 히어로 시작점 직전까지 분리한다.
- `home:source:migrate-detail-sections-boot`: 남은 코드를 상품상세·Builder, 메인 섹션, 상세 동작, 최종 초기화 구간으로 분리한다.
- `home:source:migrate-store`: 초기 상수·preset·런타임 상태 구간을 `legacy`에서 `store`로 분류한다.
- `home:source:inventory`: 함수, `window` 공개 이름, 정적 이벤트 연결을 JSON과 초보자용 표로 만든다.
- `home:source:verify`: 소스 조각을 메모리에서 합친 결과가 루트 HTML과 완전히 같은지 확인한다.
- `home:build`: 소스 조각을 `dist`의 단일 HTML로 조립한다.

## 기능별 분리 순서

- [x] 최초 5개 조각을 합쳐 현재 HTML과 바이트·hash가 같은지 확인했다.
- [x] 전역 변수와 함수 호출 관계 목록을 만들었다. — `DEPENDENCY_INVENTORY.md`, `function-inventory.json`.
- [x] 독립적인 `performance`와 `loading`부터 이동했다.
- [x] `data`와 `store`를 이동하고 조립 결과가 같은지 확인했다.
- [x] 메인 `sections`를 이동하고 공개 화면 E2E를 확인했다.
- [x] `detail`과 `member`를 이동하고 기존 A/B 참여자·딥링크 회귀 결과가 보존되는지 확인했다.
- [x] 남은 전역 순서 의존 코드를 `boot`로 명시했다. 1차 분류가 끝나 활성 `legacy` 조각은 0개다.
- [x] 모든 파일을 원래 순서대로 합쳐 동일한 단일 HTML을 만들었다. — 2,767,496 bytes, SHA-256 `B6D09D1AA648D567BBF0BB5CCBF4A98D9EA653E1648C28318C56596080C773FA`.

## 복구 방법

빌드나 소스 분리 중 하나라도 다르면 새 산출물을 배포하지 않는다.

1. `npm.cmd run home:source:verify`를 실행한다.
2. `match: false`이면 루트 `golfjoin_main.html`을 현재 운영 기준으로 유지한다.
3. `dist/golfjoin-main/golfjoin_main.html`은 검증 산출물이므로 배포 대상에서 제외한다.
4. 수정한 소스 조각과 `source-manifest.json`을 비교해 달라진 조각만 찾는다.
5. 복구가 필요하면 기존 소스 디렉터리를 삭제하거나 덮어쓰지 말고 먼저 별도 보존한다. 그 뒤 깨끗한 작업공간에서 운영 기준 HTML로 `home:source:init`을 다시 수행한다.
6. hash, 전체 단위검사, PC/MO E2E를 다시 통과하기 전에는 루트 운영 기준 파일을 교체하지 않는다.

최초 기준은 `source-manifest.json`의 `baselineSha256`과 `baselineBytes`에 기록된다. 추출 명령은 기존 manifest나 조각이 있으면 중단하므로 편집된 모듈을 자동으로 덮어쓰지 않는다.

## 소스맵과 공개 범위

3단계 첫 빌드는 원문 조각을 순서대로 합칠 뿐 별도 소스맵을 만들지 않는다. 따라서 회원정보나 운영 비밀값이 든 소스맵이 외부에 배포될 경로도 없다. `source-manifest.json`에는 상대 경로, 바이트 수, SHA-256만 기록하고, 자동 의존성 목록에는 함수명·이벤트명·소스 위치만 기록한다. 향후 외부 JS를 도입할 때 소스맵 공개 여부를 다시 승인한다.
