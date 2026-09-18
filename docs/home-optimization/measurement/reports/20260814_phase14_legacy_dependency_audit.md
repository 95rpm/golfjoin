# 14단계 Legacy 의존성 감사 보고서

작성일: 2026-08-14  
대상: `golfjoin_main.html` 소스 조각과 현재 운영 데이터 로딩 경로  
자동 감사 결과: `artifacts/stage14-legacy-audit.json`

## 결론

- [x] 현재 Legacy 경로 8개를 실제 정의·호출 위치 기준으로 조사했다.
- [x] 메인페이지 최초 진입에서 전체 상품 로더를 자동 호출하는 곳은 0개임을 확인했다.
- [x] 전체 상품 로더 호출 5개는 Product Discovery 장애 복구 3개와 회원 딥링크 복구 2개뿐임을 확인했다.
- [x] 지금 바로 안전하게 삭제할 수 있는 Legacy 경로는 0개로 판정했다.
- [x] 14단계의 다음 변경은 Legacy 삭제가 아니라 Release V2 비로그인 적용률 1%→10% 확대만 수행한다.

쉽게 말하면, 현재 오래된 코드는 평소 첫 화면을 무겁게 만드는 자동 작업이 아니라 신규 데이터가 실패했을 때 화면을 살리는 안전망 역할을 한다. 안전망을 먼저 없애도 초기 속도는 거의 빨라지지 않으므로 이번 전환에서는 그대로 둔다.

## 경로별 판정

| 경로 | 현재 역할 | 호출 수 | 이번 삭제 | 삭제를 다시 검토할 조건 |
|---|---:|---:|---:|---|
| `loadGolfJoinHomeCardsJson` | 비대상 사용자의 주 경로 | 2 | 금지 | Release V2가 로그인 포함 100%에서 안정화 |
| `loadGolfJoinHomeSummaryJson` | home cards 장애 복구 | 4 | 금지 | 실제 장애 관찰에서 호출 0건 확인 |
| `hydrateHomeBootstrapLightFromGoogleSheet` | 로그인·비대상 live 주 경로 | 2 | 금지 | Release V2 live 데이터가 로그인 포함 100%에서 정합성 통과 |
| `ensureGolfJoinProductFamilyCatalogLoaded` | 상품군 주 경로·복구 | 2 | 금지 | V2 비대상과 상품군 fallback이 모두 제거 가능해진 뒤 |
| `ensureExternalGolfJoinProductsLoaded` | Product Discovery·딥링크 장애 복구 | 5 | 금지 | 원격 차단 수단과 호출 관찰 장치가 준비된 뒤 |
| `loadSecretTourGoodsProducts` | 전체 상품 복구의 최후 ERP 파싱 | 1 | 금지 | 전체 상품 fallback을 원격으로 차단해도 복구 가능한지 검증한 뒤 첫 제거 후보 |
| `loadLegacySecretTourGoodsDetail` | 공개 상세 스냅샷 장애 복구 | 2 | 금지 | 모든 상품 상세 스냅샷의 완전성과 별도 손상 복구 경로 확보 |
| `loadGolfJoinProductGroupAvailabilityLegacy` | 상품군 가용일 객체 장애 복구 | 3 | 금지 | 모든 가용일 객체의 완전성과 원격 복구 장기 확인 |

호출 수는 함수 정의를 제외한 정적 호출 위치 수다. 사용자 한 번의 접속에서 모두 실행된다는 뜻은 아니다.

## 현재 적용 상태

- [x] 감사 시작 시점 운영 `5C09A3C5`의 적용률은 100 basis points, 즉 비로그인 사용자 1%다.
- [x] 14-3 후보 `B45F74A7`을 운영에 적용해 1000 basis points, 즉 비로그인 사용자 10%로 전환했다.
- [x] 로그인 사용자는 아직 Release V2 대상이 아니다.
- [x] Product Discovery는 별도 Gate를 사용하며, 전체 상품 로더는 그 실패 시 fallback이다.
- [x] 전체 상품 로더의 최초 부팅 호출 수는 0이다.
- [x] 즉시 삭제 후보 수는 0이다.

## 10% 전환 안전 원칙

- [x] `GOLFJOIN_HOME_DATA_V2_ROLLOUT_BASIS_POINTS`만 100에서 1000으로 바꾼다.
- [x] 로그인 경로, Product Discovery 비율, 상세·가용일·전체 상품 fallback은 바꾸지 않는다.
- [x] 현재 운영 `5C09A3C5` HTML을 즉시 복구본으로 포함한다.
- [x] Release V2 원격 Gate OFF 명령을 배포 전에 다시 적어 둔다.
- [x] 소스 조각 일치, 단위시험, 경량 HTML, CSS/JS 해시·SRI·Brotli 예산을 모두 재검사한다.
- [x] 테스트 게시판 eventPlanSeq 20에서 PC·모바일과 bucket 999/1000 경계를 확인한 후에만 운영으로 옮긴다.
- [ ] 운영에서 문제가 있으면 먼저 Release V2 Gate를 OFF하고, 화면 자산 문제면 HTML을 복구한다.

로컬 검증 후보는 `deploy/stage14-rollout/home-data-v2-10pct-20260814`에 있다. 배포 HTML은 `B45F74A7`, 신규 자산 revision은 `gha_48362bc64e0ce0b00aeafc79`, 즉시 복구 HTML은 현재 운영과 동일한 `5C09A3C5`다. JavaScript Brotli는 188,361B로 200KiB 예산을 16,439B 여유 있게 통과했다. 단위시험 138/138과 PC·모바일 로컬 브라우저 4/4를 통과했다.

GCS 선업로드 후 `www.secret-tour.com`과 `m.secret-tour.com` Origin 각각에서 CSS·JS 총 4건의 HTTP 200, 정확한 MIME, gzip/Brotli, CORS, immutable 캐시, 전송 bytes와 압축 해제 논리 SHA-256을 모두 확인했다. 이 업로드만으로 운영 HTML은 바뀌지 않았다. 사정에 따라 테스트 게시판은 eventPlanSeq 19에서 20으로 변경했으며, 20번에서 신규 revision·Critical CSS·외부 자산 오류 0건·PC 상세 열기/닫기·앱 모바일 가로 넘침 0px를 확인했다.

eventPlanSeq 20의 실제 Origin에서 비로그인 bucket 999는 `V2_RUNNING`·Release 요청 3건, bucket 1000은 `LEGACY_READY`·Release 요청 0건으로 정확히 분리됐다. PC와 모바일 두 환경의 두 경계값 총 4/4가 통과했고 상품 상세 열기/닫기와 모바일 앱 가로 넘침 0px도 함께 확인했다.

## 운영 10% 전환 결과

- [x] 운영 eventPlanSeq 3에 `B45F74A7`을 적용했다.
- [x] 실제 운영 revision은 `gha_48362bc64e0ce0b00aeafc79`이며 외부 자산 오류는 0건이다.
- [x] 운영 PC·모바일에서 bucket 999 신규 경로와 bucket 1000 기존 경로 총 4/4를 통과했다.
- [x] 신규 경로는 Release 요청 3건, 비대상 기존 경로는 Release 요청 0건이다.
- [x] 상품 상세 열기/닫기와 830px 스크롤 복원, 모바일 앱 가로 넘침 0px를 확인했다.
- [x] 로그인 Chrome에서는 Release 요청 0건, 기존 홈 데이터 경로, 마이메뉴→내 예약과 내가 만든 일정·참여중·다녀온 일정 탭을 확인했다.
- [x] 운영 콘솔 오류·경고는 0건이다.
- [x] 화면 자산 문제의 즉시 복구본 `5C09A3C5`와 데이터 문제의 Release V2 Gate OFF 절차를 유지한다.

현재 상태는 `production-deployed-verified`다. Legacy는 삭제하지 않았으며 다음 작업은 10% 운영 상태를 기준으로 50% 확대 여부를 결정하는 것이다.

## 삭제를 보류한 이유

1. Release V2는 아직 비로그인 1%이고 로그인 사용자는 기존 live 경로를 쓴다.
2. 현재 전체 상품 로더는 초기 화면에서 자동으로 실행되지 않아 삭제해도 첫 진입 속도 이득이 없다.
3. 상세 스냅샷이나 Product Discovery 객체가 하나라도 빠졌을 때 기존 경로가 사용자 화면을 복구한다.
4. 호출 빈도를 중앙에서 집계하지 않기로 한 상태이므로, 호출 0건을 증명하지 못한 코드를 삭제하면 안 된다.

## 자동 재검사

```bash
npm.cmd run home:stage14:audit
node --test tests/unit/stage14-legacy-audit.test.js
```

두 명령 모두 성공하고 `immediateDeletionCandidateCount`가 `0`이어야 이번 판정과 일치한다.
