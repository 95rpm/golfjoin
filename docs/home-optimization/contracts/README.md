# 골프조인 데이터 계약

## 데이터 계약이란

데이터 계약은 화면과 서버가 서로 약속한 정보의 이름과 형식이다. 예를 들어 상품에는 숫자로 된 `goodSeq`, 일정에는 `eventSeq`, 상품군에는 `familyId`가 있어야 한다. 이 값이 빠지거나 서로 다른 상품을 가리키면 화면에서 사용하기 전에 테스트가 실패하도록 한다.

## 현재 완료된 계약

| 계약 | 스키마 값 | 검사하는 핵심 내용 |
|---|---|---|
| 홈 매니페스트 | `secret-golf-join-home-manifest-v1` | 활성 홈 카드 리비전과 파일 경로 일치 |
| 홈 카드 | `secret-golf-join-home-cards-v2` | `goodSeq`, `eventSeq`, 가격, 출발일·귀국일, 상태, 가용일 리비전 |
| 상품 출발 가능일 | `secret-golf-join-product-availability-v1` | 상위 상품과 각 일정의 `goodSeq` 일치, 날짜 순서, 건수 |
| 상품군 카탈로그 | `golfjoin-product-family-catalog-v1` | `familyId`, 대표상품, 구성상품, 가격·기간·행사번호, 역매핑 |
| 상품군 매니페스트 | `golfjoin-product-family-manifest-v1` | 활성 리비전과 카탈로그 파일 경로 일치 |
| 공개 홈 부트스트랩 | `secret-golf-join-home-bootstrap-light-v1` | `scheduleId`, 생성자·참여자, ERP 상품·행사번호, 현재인원·남은자리·성별, 공개 개인정보 제한 |
| 시트 참여자 요약 | `golfjoin-schedule-participant-summary-v1` | 정원·현재인원·남은자리·참여자명 수·성별 구성의 상호 일치 |
| 상품상세 스냅샷 | `secret-golf-join-product-detail-v1` | 상품·행사번호, 기간, 가격, 항공, 포함·불포함·참고, 일정표, 상세 이미지, 원본 URL 일치 |

JSON Schema 파일은 `server/google-sheet-proxy-function/contracts/`에 있고 검증기는 `server/google-sheet-proxy-function/data-contracts.js`에 있다.

## 검증 결과 형식

```js
const { validateDataContract } = require("./data-contracts");

const result = validateDataContract("homeCardsV2", payload);
if (!result.valid) {
  console.log(result.issues);
}
```

오류에는 `$`로 시작하는 필드 위치와 오류 코드만 남긴다. 실제 회원명, 휴대폰, 이메일 또는 필드값을 복사하지 않는다.

## 현재 운영 영향

- 검증 모듈은 아직 실제 GCS 발행 직전에 연결하지 않았다.
- 따라서 이번 추가만으로 Cloud Function 응답이나 발행 결과가 달라지지 않는다.
- 먼저 생성기 결과를 테스트에서 검증하고, 1단계 후반에 fallback 정책과 함께 발행 경로 연결 여부를 결정한다.

## 테스트 방법

PowerShell에서는 실행 정책 문제를 피하기 위해 `npm.cmd`를 사용한다.

```powershell
cd D:\secrettour_join\260521\golfjoin\server\google-sheet-proxy-function
node --check data-contracts.js
node --test data-contracts.test.js
npm.cmd test
```

현재 결과는 신규 계약 테스트 27/27, 현재·신규 경로 비교 테스트 9/9, 전체 서버 테스트 72/72 통과다.

운영 `home_bootstrap_light` 응답도 개인정보 원문을 출력하거나 저장하지 않는 방식으로 검증했다. 2026-08-06 기준 HTTP 200, 계약 오류 0건이다.

### 공개 모임 계약에서 보장하는 것

- A가 2명으로 일정을 만들고 B가 1명 참여하면 현재인원과 공개 참여자 아이콘은 3명이어야 한다.
- 생성 일정과 참여 요약의 `scheduleId`, 신청 ID, ERP `goodSeq`·`eventSeq`가 서로 다른 대상을 가리키면 실패한다.
- 현재인원, 남은자리, 공개 아이콘 수, 남녀 집계가 서로 다르면 실패한다.
- 생성자의 공개 프로필이 일정의 참여자 목록에서 빠지면 실패한다.
- 관리자 대규모 일정은 현재 화면 정책에 따라 최대 40명까지만 공개 아이콘을 제공할 수 있다.
- 공개 아이콘에는 휴대폰, 이메일, 회원번호·회원키 같은 비공개 식별값을 넣을 수 없다.
- 같은 생성자라도 서버 생성 위치에 따라 `iconSeed`가 달라질 수 있으므로, 생성자 포함 여부는 마스킹된 공개 프로필 묶음으로 검사한다.

### 상품상세 계약에서 보장하는 것

- `goodSeq`, `eventSeq`, ERP 상품·행사번호와 원본 `goods_view` URL이 모두 같은 상품을 가리켜야 한다.
- 출발일·귀국일, 가격, 항공편, 포함·불포함·참고사항, 일정표, 대표·슬라이드·상품소개 이미지를 한 계약으로 검사한다.
- 각 상세 영역은 `available`, `empty`, `unavailable` 중 하나로 상태를 명시한다. 데이터가 실제로 비어 있는 경우와 파싱 실패를 구분하기 위한 값이다.
- `available`이라고 표시한 일정·이미지 등이 실제로 비어 있으면 실패한다.
- 항공 상태가 `loaded`인데 항공편이 없거나 도착시각이 출발시각보다 빠르면 실패한다.
- 상세 데이터가 `partial` 또는 `unavailable`이면 화면이 fallback을 선택할 수 있도록 누락 사유 코드가 필요하다.
- 상세 이미지는 HTTP/HTTPS 주소만 허용한다.

## 현재 경로와 신규 경로 비교

`server/google-sheet-proxy-function/data-contract-comparison.js`는 현재 경로와 이후 신규 경로를 다음 세 묶음으로 비교한다.

- 홈 상품: 상품·행사·상품군 ID, 가격, 출발일·귀국일, 상태
- 공개 모임: 일정 ID, ERP 상품·행사번호, 현재인원, 남은자리, 상태, 공개 참여자 프로필
- 상품상세: 상품·행사번호, 제목, 기간, 가격, 포함·불포함·참고, 일정, 항공, 이미지

표기 형식만 다른 날짜와 가격은 같은 값으로 정규화한다. 공개 참여자는 순서나 `iconSeed`가 달라도 마스킹된 공개 프로필이 같으면 같은 사람 구성으로 판정한다. 누락·추가·불일치 결과에는 원본 일정 ID나 상품번호 대신 16자리 SHA-256 식별자 해시와 필드 경로, 오류 코드만 남긴다.

## 다음 계약

- [x] 공개 모임 live 응답: `scheduleId`, 생성자, 참여자, 현재인원, 모집상태
- [x] 상품상세 스냅샷: `goodSeq`, `eventSeq`, 기간, 항공, 포함·불포함, 일정, 상세 이미지
- [x] 현재 경로와 이후 신규 경로의 핵심 필드 비교 테스트
- [ ] 비로그인·로그인·회원 교체·일정 생성/참여/모집완료 자동 E2E
