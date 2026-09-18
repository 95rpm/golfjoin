# 11단계 상품상세 최종 후보 보고서

## 결론

11-1부터 11-6까지 구현과 후보 검증을 완료했다. 현재 운영 HTML은 안전한 직전 기준본 `CA9CFB31...`을 그대로 유지하고 있으며, 아직 11단계 후보 HTML을 운영에 덮어쓰지 않았다.

최종 후보 HTML은 `dist/golfjoin-main/golfjoin_main.html`, 2,849,746 bytes, SHA-256 `2549C749A727CED129B9C996B3686F8CBB05D18C5CD21828BA5B82B1D01A8291`이다.

## 사용자가 체감하는 변경

- 상품카드를 누르면 가용일 응답을 기다리지 않고 제목·대표이미지·가격이 포함된 상세 껍데기가 먼저 열린다.
- 실제 신청 가능한 행사는 가용일 검증이 끝난 뒤 연결되므로 임시 대표상품을 잘못 신청하지 않는다.
- 여행기간 설명을 만들기 위해 다른 기간의 `goods_view`를 미리 여러 건 읽지 않는다.
- 상세 하나를 여는 과정에서 전체 상품 파일을 암묵적으로 내려받지 않는다.
- 포함·불포함·참고·상세일정·시설 이미지는 검증된 공개 스냅샷을 우선 사용한다.
- 공개 스냅샷이 없거나 404, 잘못된 상품, 금지된 개인 필드, 잘못된 스키마이면 기존 `goods_view`를 정확히 한 번 사용한다.
- 항공편은 별도 영역에서 읽고 실패하거나 늦으면 다시 시도할 수 있다. 모달 열기와 스크롤을 막지 않는다.
- PC와 MO 모두 모달이 열린 동안 뒤 화면 위치가 고정되고 닫으면 원래 좌표로 복원된다.

## 데이터 안전 원칙

- 공개 스냅샷에는 회원가, 개인 혜택, 실시간 좌석, 동적 항공편을 저장하지 않는다.
- 서버 저장 전 데이터 계약을 검사하고 브라우저가 사용하기 전 다시 검사한다.
- `detailRevision + goodSeq + eventSeq`가 맞는 불변 파일만 신뢰한다.
- 여러 화면이 공유하는 Promise는 모달 하나가 닫혔다고 강제 중단하지 않는다. 닫힌 화면의 소비자 세대를 무효화해 늦은 응답은 버리고, 공유 요청은 다른 화면과 캐시를 위해 안전하게 완료한다.

## 자동검증 결과

| 검사 | 결과 |
|---|---:|
| 프런트 단위시험 | 80/80 통과 |
| 후보 HTML inline JavaScript 문법 | 1/1 통과 |
| 서버 계약·발행·rollback 전체시험 | 127/127 통과 |
| 실제 Secret Tour 상품 HTML ↔ 공개 스냅샷 파싱 대조 | 6/6 일치 |
| 느린 가용일·늦은 응답·재시도·fallback PC/MO | 10/10 통과 |
| 상세 즉시 표시·기간 전환·스크롤 잠금/복원 PC/MO | 2/2 통과 |
| MD PICK·Builder·일반 모임·내예약 스냅샷 경로 PC/MO | 2/2 통과 |

후보 시험에서 정상 스냅샷은 요청 1건, `goods_view` 0건이었다. 잘못된 상품 스냅샷과 404 스냅샷은 각각 스냅샷 1건 뒤 `goods_view` 1건으로 자동 복구했다. 늦은 가용일과 늦은 상세 응답이 닫힌 모달을 다시 열거나 다른 기간을 덮은 경우는 0건이었다.

## 서버 운영 반영 파일

Cloud Shell의 `/home/llno95ll/google-sheet-proxy-function`에 다음 런타임 파일이 정확히 반영돼야 한다.

- `index.js`
- `product-detail-meta.js` — 신규 파일
- `home-products.js`
- `data-contracts.js`
- `release-sources.js`
- `product-family.js`
- `contracts/product-detail-index-v1.schema.json`
- `contracts/product-detail-snapshot-v1.schema.json`
- `contracts/product-family-catalog-v1.schema.json`

Cloud Shell에서 `npm test`까지 실행하려면 다음 시험 파일도 같이 반영한다.

- `product-detail-meta.test.js`
- `home-products.test.js`
- `data-contracts.test.js`
- `release-sources.test.js`
- `product-family.test.js`

## 반드시 지킬 배포 순서

1. 서버 런타임·계약·시험 파일을 Cloud Shell에 반영한다.
2. `node --check`와 `npm test`를 통과시킨 뒤 Cloud Function을 배포한다.
3. 대시보드의 상품업데이트를 실행한다. 이 단계에서 공개 상세 스냅샷과 홈 카드의 상세 참조가 발행된다.
4. Release V2 `shadow`가 `valid: true`, `issueCount: 0`인지 확인하고 `publish`한다.
5. 새 Release의 detail index 상태와 공개 객체를 확인한다.
6. 마지막에만 후보 HTML `2549C749...`을 운영 게시판에 배포한다.
7. PC·MO에서 실제 네트워크와 화면을 확인한다.

상품업데이트를 서버 배포 전에 실행한 경우에는 공개 상세 스냅샷 발행으로 인정하지 않는다. 11단계 서버 배포 후 반드시 한 번 더 실행해야 한다.

## 11-7 운영 확인 기준

- 상품업데이트 응답의 `productMeta.publicDetail`에서 실패 0건을 확인한다.
- 스냅샷 준비 상품 상세은 `product-detail/<revision>/<goodSeq>.json` 1건, `goods_view` 0건이어야 한다.
- 스냅샷이 준비되지 않은 상품은 기존 `goods_view`로 정상 표시돼야 한다.
- 상품군 가용일 요청은 상품군당 1건이어야 한다.
- 상세 진입으로 전체 상품 파일이 새로 시작되면 안 된다.
- PC·MO에서 클릭 후 껍데기, 여행기간, 포함·불포함·일정·이미지, 항공편, 닫기 후 위치 복원을 확인한다.
- MD PICK, Builder, 일반 모임, 내예약 상세를 각각 확인한다.
- 콜드 상세 완료 p75 1.5초 이내, 웜 기간 전환 250ms 이내, 콜드 기간 전환 p75 1초 이내를 3회 측정한다.

## 11-7 운영 진행 기록

- Stage 11 서버를 배포한 뒤 첫 상품업데이트에서 `normalizeProductFamilyGolfSummary is not a function` 오류가 발생했다. 원인은 배포 묶음에 최신 `product-family.js`가 빠져 `index.js`가 요구하는 export와 운영 파일이 달랐기 때문이다.
- `product-family.js`, `product-family.test.js`, `contracts/product-family-catalog-v1.schema.json`을 보완하고 해당 export를 직접 검사하는 회귀시험을 추가했다. 로컬 서버 전체 127/127 통과 후 재배포했다.
- 재배포 뒤 대시보드 상품업데이트가 완료됐다. 공개 매니페스트 생성 시각은 `2026-08-12T17:04:47+09:00`, 홈 카드 리비전은 `ghc_bd5d86e1ec5b2e25eb01186f`이다.
- `tests/e2e/diagnostics/stage11-public-detail-production-audit.js`로 공개 객체를 전수 검사했다. 상품 메타 150개, 상세 스냅샷 150/150, 실패 0, 중복 주소 0, 상품코드·리비전 불일치 0, 비공개 필드 0이다.
- 원본 홈 카드의 대표 상품 150개에는 `status`가 없지만 Release 생성기의 기존 정규화 규칙이 이를 `available`로 채운다. 동일 정규화를 적용한 Release 입력 계약은 오류 0건으로 통과했다.
- 첫 Release Shadow는 `homeBootstrapLightV1` 계약에서 안전 중단됐다. 캐시 우회 최신 응답에도 공개 일정 5건과 연결되지 않는 `new_schedule` 참여자 요약 1건이 있었고 `orphan_participant_summary`가 정확한 원인이었다.
- 원본 시트 행을 삭제하지 않고 공개 live 공통 정제에서 일정 본문 없는 새 모임 요약만 제외하며, 원천 참여자 집계도 대상 일정을 찾지 못한 신청을 건너뛰게 보완했다. 실제 최신 응답은 일정 5건을 유지하고 요약 7→6건, 계약 오류 1→0건이 됐다. 관리자 추천일정 요약은 그대로 유지된다.
- 고아 요약 회귀시험 2건을 추가했고 로컬 서버 전체 129/129를 통과했다. Cloud Shell에서는 pass 124·fail 0·Cloud Function 단독 HTML 검사 정상 skip 1을 통과한 뒤 보완 서버를 배포했다.
- 배포 후 캐시 우회 운영 응답은 HTTP 200·`sheets_api`, 일정 5건·참여자 요약 6건·경고 0건이며 `homeBootstrapLightV1` 계약 오류가 0건이다. 운영 HTML은 여전히 `CA9CFB31...`이며 후보 HTML은 아직 배포하지 않았다. 다음 순서는 Release Shadow → Publish → 공개 객체 확인 → 후보 HTML 배포이다.
- 보완 배포 후 Shadow `gjs_24f6a03407c598ead4db8c7a`는 `valid: true`, 오류 0건이다. 상품 150, 가용 행사 10,343, 새 모임 5, 참여자 요약 6, 상품군 28건에서 Legacy와 후보의 누락·추가·필드 불일치가 모두 0건이다. 다음 순서는 Gate OFF Publish → 상세 인덱스·객체 확인 → 후보 HTML 배포이다.
- Gate OFF Release `gjr_e010727ecd2b7a7610a3c129`을 발행했다. 공개 root와 archive는 일치하고 Release 객체 5/5의 HTTP 200·논리 bytes·SHA-256·공통 stamp가 정상이다. 상세 인덱스는 `ready` 150건이며 실제 상세 스냅샷 150/150의 계약·상품코드·행사코드·리비전·비공개 필드·중복 주소 검사가 모두 통과했다.
- 새 Release를 가상 ON으로 연결한 후보 HTML은 PC·MO에서 Legacy 화면 동일성, 손상 객체 fallback, Gate OFF/ON 분기, Release 핵심 요청 3건, 상품군 단일 가용일 요청과 기간 선택 UI를 10/10 통과했다.
- 후보 HTML 2,849,746 bytes·`2549C749A727CED129B9C996B3686F8CBB05D18C5CD21828BA5B82B1D01A8291`을 운영 배포했다. 게시판 저장 과정에서 전체 HTML bytes는 정규화됐지만 PC·MO 배포본의 Stage 11 핵심 함수 9개 본문 해시는 후보와 9/9 정확히 일치했다. Gate OFF 비대상·대상 브라우저 분기도 PC·MO 4/4 통과했고 페이지 오류는 0건이다.
- Gate OFF PC 실운영에서 첫 MD PICK 상세은 공개 `product-detail/gpd_fc08c44e05b4b491049e470a/30001104.json`만 1건 읽고 `goods_view`와 `golfjoin_home_summary.json`은 0건이었다. 여행기간 3개·포함/불포함·참고사항·이미지 10개 이상이 정상이고, 배경을 830px에 고정한 상태에서 모달 본문을 600px 스크롤한 뒤 닫으면 배경 위치가 정확히 830px로 복원됐다.
- 동일 검사를 자동화한 `tests/e2e/production-diagnostics/stage11-detail-off.spec.js`를 추가했다. 권한 복구 후 격리 Chrome PC·Pixel 7 두 프로젝트가 2/2 통과했다. 상세 껍데기는 PC 6.6ms·MO 16.8ms, 공개 상세 요청은 각각 1건, `goods_view`·항공편·전체 상품 요약 재조회는 각각 0건이며 모달 내부 스크롤과 원래 페이지 위치 복원이 모두 정상이다.
- `gjr_e010727ecd2b7a7610a3c129`의 Gate를 ON했다. 운영 PC·Pixel 7에서 비대상 99% Legacy, 익명 1% Release 핵심 3요청·Legacy 0요청, 합성 로그인 회원 제외, 로컬 화면 1회·Release 최종 렌더 1회를 8/8 통과했다. 익명 1% 상세도 공개 상세 1건·`goods_view` 0건·전체 상품 재조회 0건이며 스크롤 복원이 정상이다.
- 메인 진입 콜드·웜을 PC·MO 각 3회 측정했다. 콜드 LCP p75는 PC 1,704ms·MO 1,472ms, 웜은 PC 396ms·MO 388ms다. 모든 회차에서 Release 요청 3건, Legacy 핵심 요청 0건, 웜 정적 데이터 네트워크 재다운로드 0건, 페이지 오류·깨진 대표이미지 0건이며 스크롤 가능 상태다.
- 상세·기간·항공편을 PC·MO 각 3회 측정했다. 상세 껍데기 p75는 PC 8.3ms·MO 28.8ms, 콜드 상세 완료는 133.2/178.6ms, 콜드 기간 전환은 157.6/94.3ms, 웜 기간 전환은 21.5/23.5ms다. 항공편 응답 p75는 37.3/126.4ms, 모달 닫기는 28/32ms이며 모든 회차에서 `goods_view`·전체 상품 로더·페이지 오류가 0건이다.
- 2026-08-13 실제 Gate OFF 복구를 수행했다. root는 같은 `gjr_e010727ecd2b7a7610a3c129`과 객체 5개를 유지한 채 `browserReadEnabled: false`로 마지막 교체됐다. PC·Pixel 7에서 비대상 Legacy, 강제 1%의 root 확인 후 원격 OFF 복귀, 상세 공개 스냅샷 각 1건, `goods_view`·전체 상품 재조회 각 0건, 모달 내부 스크롤·페이지 위치 복원이 6/6 통과했다.
- 동일 Release Gate를 다시 ON했다. root generation `1786578895779042`, `browserReadEnabled: true`, 객체 5개와 root-last 교체를 확인했다. 재복원 뒤 PC·Pixel 7에서 비대상 99% Legacy, 익명 1% Release 3요청·Legacy 0요청, 로그인 제외, 상세 공개 스냅샷·스크롤, 로컬 1회·Release 최종 1회 렌더를 8/8 재통과했다. 운영 최종 상태는 `gjr_e010727ecd2b7a7610a3c129` 익명 1% Gate ON이다.

## 복구 기준

- 서버 배포나 상품업데이트가 실패하면 HTML을 배포하지 않고 운영 `CA9CFB31...`을 유지한다.
- 새 HTML에서 심각한 문제가 생기면 게시판 HTML을 `CA9CFB31...`로 되돌린다.
- Release 객체 문제가 있으면 Gate OFF 후 직전 정상 Release로 rollback한다.
- 공개 상세 스냅샷 하나만 실패하면 전체 rollback하지 않고 해당 상품의 기존 `goods_view` fallback을 사용한다.
