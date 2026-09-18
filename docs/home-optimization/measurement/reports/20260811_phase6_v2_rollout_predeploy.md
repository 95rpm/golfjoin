# 6-4d 익명 1% Release V2 배포 전 검증

## 결론

- [x] 익명 이용자 중 브라우저별 고정 1%만 V2 후보가 된다.
- [x] 로그인 회원은 후보 버킷이어도 V2 요청을 만들지 않는다.
- [x] 원격 스위치가 OFF이면 후보 1%도 매니페스트 한 건만 확인한 뒤 기존 경로를 사용한다.
- [x] 원격 스위치가 ON이면 PC·MO 모두 `release manifest`, `home-static`, `home-live` 세 건만 요청한다.
- [x] 원격 ON 중 기존 홈 카드·상품군 매니페스트·`home_bootstrap_light` 중복 요청은 0건이다.
- [x] 객체가 손상되면 DOM을 바꾸지 않고 기존 화면을 유지한다.
- [x] Cloud Function 운영 배포를 완료했다.
- [x] 후보 `CE547BE5...` HTML 운영 배포를 완료했다.
- [x] 배포 후 `status`에서 `browserReadEnabled=false`, 객체 5개를 확인했다.

쉬운 설명: 새 길을 쓸 사람을 브라우저에 고정하고, 서버가 허용할 때만 세 파일을 받는다. 서버가 허용하지 않거나 파일이 잘못되면 기존 길로 돌아간다.

## 구현한 안전장치

- [x] `0~9999` 중 한 값을 `localStorage`에 저장하고 `0~99`만 1% 후보로 사용한다.
- [x] 회원키가 있으면 V2 판단을 중단해 개인정보가 있는 회원 화면은 기존 경로만 사용한다.
- [x] 원격 ON은 현재 root의 정확한 `releaseRevision`을 요구한다.
- [x] 원격 OFF는 리비전 입력 없이 즉시 실행할 수 있다.
- [x] publish와 rollback은 항상 원격 gate를 OFF로 되돌린다.
- [x] root manifest는 GCS generation 조건으로 교체해 동시 관리자 작업 충돌을 차단한다.
- [x] V2 판단 중에는 기존 네트워크만 잠시 보류하고 로컬 캐시 화면은 그대로 먼저 렌더한다.
- [x] V2 결정은 `finally`에서 반드시 해제해 OFF·비대상·오류 시 Legacy가 멈추지 않는다.

## 발견하고 제거한 중복 요청

첫 자동 ON 시험에서는 Release 세 요청 외에 기존 `web/product-family/manifest.json`이 한 번 더 호출됐다. 초기 로컬 화면을 그리는 동안 상품군 로더가 V2 판단보다 먼저 시작한 것이 원인이었다.

화면의 빠른 로컬 렌더는 유지하고, V2 판단이 끝날 때까지만 `ensureHomeGolfJoinProductsLoaded()`와 `ensureGolfJoinProductFamilyCatalogLoaded()`의 네트워크 시작을 보류했다. 그 결과 PC·MO 자동 ON에서 Release 세 요청만 남았다.

## 배포 후보

| 항목 | 값 |
|---|---|
| 파일 | `golfjoin_main.html` |
| 크기 | 2,802,222 bytes |
| SHA-256 | `CE547BE550F820C39DD33156DDB0C26EDE8B95B61B46EDAD5596D547DCF9FA5A` |
| 기준 Release | `gjr_ce2d61076362dd3e8f26c053` |
| 배포 전 원격 gate | `false` |

## 자동검사 결과

| 검사 | 결과 |
|---|---:|
| 메인 단위·문법 | 65/65 통과 |
| 서버 계약·발행·gate | 103/103 통과 |
| Release V2 PC/MO | 8/8 통과 |
| 로그아웃 화면·상세·스크롤 | 8/8 통과 |
| 기존 네트워크 fallback | 10/10 통과 |
| 회원·내예약·딥링크 | 20/20 통과 |
| A 생성·B 참여자 표시 | 8/8 통과 |

## 운영 반영 순서

- [x] 1. 변경된 서버 파일을 Cloud Shell에 반영했다.
- [x] 2. 서버 문법검사와 `npm test` 뒤 Cloud Function을 배포했다.
- [x] 3. `status`에서 `gjr_ce2d61076362dd3e8f26c053`과 `browserReadEnabled=false`를 확인했다.
- [x] 4. 후보 `CE547BE5...` HTML을 게시판에 배포했다.
- [x] 5. PC·MO에서 V2 블록 SHA와 원격 OFF 상태의 기존 화면을 확인했다.
- [ ] 6. `status`가 보여준 정확한 현재 Release로 `gate-on`을 실행한다.
- [ ] 7. 고정 1% 대상 PC·MO에서 요청 3건, 화면 동일성, 스크롤, 오류 0건을 확인한다.
- [ ] 8. 이상 시 즉시 `gate-off`를 실행한다. HTML 재배포는 필요 없다.

## 즉시 중단 명령

```bash
cd /home/llno95ll/google-sheet-proxy-function
node release-admin-cli.js gate-off --env-file=/home/llno95ll/golfjoin-sheet-api.env.yaml
```

성공 조건은 결과의 `ok: true`, `browserReadEnabled: false`, `rootUpdatedLast: true`다.

## 운영 OFF 배포 검증

- [x] PC·MO HTTP 200
- [x] 로컬·PC·MO V2 블록 33,350 bytes 일치
- [x] 블록 SHA-256 `391ae9f1ce750bf0c6cefa3ad31f66b60cb4f1785f830aefa7aaa05e2eb462d8` 일치
- [x] 99% 비대상 PC·MO Release 요청 0건
- [x] 1% 후보 PC·MO 원격 OFF 매니페스트 요청 1건, 상태 `LEGACY_READY`
- [x] 공개·상세·합성 로그인·느린 읽기·스크롤 검사 최종 10/10
- [x] 활성 Release `gjr_ce2d61076362dd3e8f26c053`, 객체 5개, 원격 gate OFF

## 원격 ON 직전 최종 Shadow

- [x] 비교 시각 `2026-08-11T17:10:19+09:00`
- [x] 상품 150/150, 불일치 0건
- [x] 가용 행사 10,458/10,458, 불일치 0건
- [x] 신규 일정 7/7, 불일치 0건
- [x] 참여 요약 6/6, 불일치 0건
- [x] 상품군 28/28, 불일치 0건
- [x] 전체 `valid=true`, `issueCount=0`
- [x] 새 live 후보 `ghl_d6b0524161d4e9e93770bffa` 확인
- [x] 발행 직전 Shadow를 다시 실행해 `valid=true`, `issueCount=0`을 확인했다.
- [x] 새 Release `gjr_ed4dfaebc393d1d5aa90a5ff` 발행 완료
- [x] 발행 snapshot `gjs_8ae40e568543c036342d44f9`, live `ghl_8624669fb715e15ffc82491e`
- [x] 공개 root와 객체 5개 HTTP 200·bytes·SHA-256 일치
- [x] 발행 후 원격 gate OFF
- [x] 새 Release 가상 ON PC·MO 2/2, Release 요청 3건·Legacy 핵심 요청 0건

## 실제 익명 1% ON 검증

- [x] `gjr_ed4dfaebc393d1d5aa90a5ff`에 `gate-on` 적용
- [x] root generation `1786436000564222`, `browserReadEnabled=true`
- [x] PC·MO 99% 비대상 Release 요청 0건
- [x] PC·MO 익명 1% `V2_RUNNING`, Release 요청 3건
- [x] 익명 1% 기존 홈 카드·상품군 매니페스트·`home_bootstrap_light` 요청 0건
- [x] PC·MO 대표이미지·상세 열기/닫기·스크롤 ±3px 복원
- [x] PC·MO 합성 로그인 회원은 1% 버킷이어도 Release 요청 0건
- [x] 페이지 오류 0건
