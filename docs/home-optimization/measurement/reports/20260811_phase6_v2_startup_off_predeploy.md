# 6단계 6-4a — V2 초기화 연결·기본 OFF 배포 전 검증

## 결론

- 판정: **서버·최신 OFF Release 검증 완료, 기본 OFF HTML 배포 가능**
- HTML SHA-256: `8DDF1DF27CC6D14E09E2C02282392B699C7C157618BE1247D7725AAF4BC88101`
- HTML 크기: 2,798,778 bytes
- 로컬 기본 스위치: `GOLFJOIN_HOME_DATA_V2_AUTO_BOOT_ENABLED = false`
- 원격 Release 스위치: 계속 `browserReadEnabled=false`
- OFF 동작: V2 함수가 즉시 종료하므로 V2 네트워크 요청은 0건이고 현재 Legacy 초기화가 그대로 실행된다.
- 발행 Release: `gjr_ce2d61076362dd3e8f26c053`
- 다음 단계: 위 HTML을 배포해 운영 요청 0건을 확인한다.

## 초보자용 설명

이번 작업은 새 데이터 길을 실제 페이지 시작 순서에 연결한 것이다. 다만 전원 스위치는 꺼 두었기 때문에 배포만으로 고객의 데이터 로딩 방식은 달라지지 않는다. 나중에 켤 때는 작은 안내 파일 1개를 먼저 받고, 상품 기본정보와 현재 모임정보 2개를 동시에 받아 총 3번의 핵심 요청으로 화면을 준비한다.

기존 상품군 기능은 별도 안내 파일과 catalog를 추가로 받아야 해서 그대로 두면 핵심 요청이 5번이 된다. 이를 막기 위해 첫 화면에 필요한 상품군 catalog를 `home-static` 안에도 포함했다. 별도 상품군 객체는 다른 기능과 복구 호환성을 위해 계속 발행하지만, V2 첫 진입은 그것을 추가 다운로드하지 않는다.

## 구현 체크리스트

- [x] 메인 초기화가 `runGolfJoinHomeDataV2Startup()`을 한 번 호출한다.
- [x] 로컬 자동 시작 기본값은 `false`다.
- [x] 기본 OFF에서는 manifest를 포함한 V2 요청이 0건이다.
- [x] 테스트 강제 ON에서는 manifest 1건 뒤 static·live를 병렬로 받아 총 3건만 사용한다.
- [x] `home-static`에 같은 리비전의 상품군 catalog를 포함한다.
- [x] 상품군 리비전이 바뀌면 `home-static` 리비전과 snapshot watermark도 함께 바뀐다.
- [x] embedded 상품군도 기존 상품군 JSON Schema와 교차 불변식을 통과해야 한다.
- [x] embedded 상품군→상품 static→공개 live 순서로 메모리 상태를 준비하고 최종 렌더는 한 번만 예약한다.
- [x] embedded 상품군이 없는 구 Release를 순수 V2로 시작하면 화면을 건드리지 않고 Legacy로 전환한다.
- [x] 이미 Legacy 상품군을 읽은 내부 비교에서는 구 Release와도 안전하게 호환된다.
- [x] manifest·객체 bytes·SHA-256·release ID·watermark 검증을 유지한다.
- [x] 전체 V2 시작 시간이 3.5초를 넘거나 일부 객체가 실패하면 Legacy로 전환한다.
- [x] 중간 적용 실패 시 상품·상품군·공개 모임·참여자 상태를 모두 이전 값으로 복원한다.
- [x] V2 성공 시 기존 홈 상품·공개 bootstrap 중복 요청과 중복 최종 렌더를 생략한다.
- [x] 회원 전용 후속 로딩과 지연 `home_stats` 경로는 이번 단계에서 바꾸지 않았다.

## 자동 검증 결과

- [x] V2 전용 단위검사 18/18
- [x] 메인 전체 단위·문법검사 62/62
- [x] Cloud Function 서버 전체검사 101/101
- [x] PC·Pixel 7 Legacy↔V2 동일성 및 객체 손상 복구 4/4
- [x] 브라우저 진단 전체 16/16
- [x] PC·MO 핵심 화면·상세·스크롤·기간 경합 스모크 8/8
- [x] PC·MO manifest·bootstrap 실패와 지연 복구 10/10
- [x] 변경 JavaScript 파일 `node --check` 통과
- [x] 분리 소스와 최종 `golfjoin_main.html` bytes·SHA-256 정확 일치
- [x] `git diff --check` 통과

## 안전장치

| 상황 | 동작 |
|---|---|
| 로컬 기본 스위치 OFF | V2 요청 없이 즉시 Legacy 사용 |
| 원격 `browserReadEnabled=false` | 로컬을 켜도 V2 커밋 거부 후 Legacy 사용 |
| 구 Release에 embedded 상품군 없음 | 순수 V2 시작을 거부하고 Legacy 사용 |
| manifest 또는 객체 변조 | bytes/hash 검증에서 차단하고 DOM 무변경 |
| 3.5초 초과 | V2 owner를 폐기하고 Legacy 사용 |
| 적용 도중 예외 | 상품·상품군·live 전체 상태 rollback, 렌더 0회 |
| 같은 Release 중복 실행 | 이미 적용된 리비전을 재렌더하지 않음 |

## 배포 파일

### Cloud Function 폴더

- `release-sources.js`
- `release-sources.test.js`
- `data-contracts.js`
- `release-integration.test.js`
- `contracts/home-cards-v2.schema.json`

운영 실수를 줄이기 위해 개별 파일보다 로컬 `server/google-sheet-proxy-function` 폴더 전체를 Cloud Shell의 기존 함수 폴더에 덮어 올리는 방식을 권장한다. `event.html`은 이번 작업 대상이 아니며 건드리지 않는다.

### 메인 HTML

- `golfjoin_main.html`
- SHA-256: `8DDF1DF27CC6D14E09E2C02282392B699C7C157618BE1247D7725AAF4BC88101`

## 안전한 배포 순서

- [x] 1. Cloud Shell의 함수 폴더에 로컬 서버 폴더 변경분을 업로드한다.
- [x] 2. 문법·전체 테스트 뒤 Cloud Function을 배포한다.
- [x] 3. `shadow`를 실행해 다섯 비교 영역의 `issueCount: 0`을 확인한다.
- [x] 4. `publish`를 실행해 embedded 상품군이 들어간 최신 Release를 만든다.
- [x] 5. 공개 root와 객체를 독립 조회해 객체 5개와 `browserReadEnabled:false`를 확인한다.
- [x] 6. SHA-256 `8DDF1DF2...`인 `golfjoin_main.html`을 PC/MO 게시 페이지에 배포한다.
- [x] 7. 로그아웃 PC·MO 첫 진입에서 V2 URL 요청 0건, 기존 카드·이미지·스크롤·상세 정상 여부를 확인한다.
- [x] 8. 로그인 첫 진입에서 나의 모임·내예약·참여자 UI와 기존 회원 API가 정상인지 확인한다.

## 운영 Release 검증 결과

- [x] Release: `gjr_ce2d61076362dd3e8f26c053`
- [x] 이전 안정 Release: `gjr_1eb61b5610dc8d1fe30b78a0`
- [x] 공개 root HTTP 200
- [x] `browserReadEnabled:false`
- [x] `home-static` HTTP 200, 329,519 bytes 일치
- [x] `home-static` SHA-256 `01c960b79cd2f78a94de82d06478fcca83452aecbc3c15d893e85976021c52ff` 일치
- [x] 상품 선언·실제·요약 수 150/150/150
- [x] embedded 상품군 선언·실제 수 28/28, 구성원 66
- [x] static 리비전 `ghc_ad9655fa3a8cd6bd130c2500` 일치
- [x] family 리비전 `pfc_119bbc9d42644e23f020b520` 일치

## 배포 후 6-4b 통과 조건

- [x] PC·MO 운영 V2 코드 블록이 로컬과 정확히 일치한다. 블록 30,632 bytes, SHA-256 `38a966a8a866407fcceb96025af6b4e100559fd6ac06e945180ab48902bfa246`.
- [x] `release-manifest-v2.json` 및 해당 release 객체 브라우저 요청이 0건이다.
- [x] MD PICK·취향맞춤·마감임박·곧출발·해외조인BEST가 현재 운영과 같다.
- [x] 상품상세 열기·닫기와 스크롤 잠금·복원이 정상이다.
- [x] 로그인 회원의 나의 모임·내예약·참여자 아이콘이 정상이다.
- [x] 콘솔 오류가 0건이다.
- [x] Release root는 계속 `browserReadEnabled=false`다.

## 운영 HTML 배포 후 결과

- [x] PC·MO HTTP 200
- [x] 로컬·PC·MO V2 블록 일치
- [x] 자동 시작 `false`, 초기화 호출 1회
- [x] 상태 `LEGACY_READY`, requestCount 0, 후보 없음, 커밋 리비전 없음
- [x] 운영 공개·상세·읽기 대기 중 스크롤·합성 로그인 8/8
- [x] 회원 세션·로그아웃/재로그인·내예약·딥링크 20/20
- [x] A 2명 생성·B 참여 3/4·모집완료 4/4·취소 8/8
- [x] 최초 검사 실패 3건은 제품 오류가 아니라 진단 필드명 2건과 스크롤 방향 1건의 검사 조건 오류였다. 실제 필드명과 스크롤 가능 방향을 사용하도록 보정한 뒤 전체 재실행을 통과했다.

## 아직 하지 않는 작업

- [ ] 원격 브라우저 스위치를 켜지 않는다.
- [ ] 익명 사용자 비율 배정을 시작하지 않는다.
- [ ] Legacy 파일·API·fallback을 삭제하지 않는다.
- [ ] 로그인 회원을 V2 공개 데이터 전환 표본에 포함하지 않는다.
- [ ] 서버·HTML OFF 배포 검증이 끝나기 전에 성능 개선 완료로 판정하지 않는다.
