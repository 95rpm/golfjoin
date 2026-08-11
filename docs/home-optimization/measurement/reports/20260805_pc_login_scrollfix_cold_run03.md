# 상세 모달 스크롤 수정 버전 PC 로그인 콜드 run03

| 구분 | 값 |
|---|---|
| 측정일 | 2026-08-05 |
| 운영 버전 | 상세 모달 스크롤 고정·복원 및 알림톡 기준 좌표 반영 버전 |
| 환경 | PC Chrome, 로그인, HTTP·회원 앱 캐시 콜드 |
| 표본 판정 | 현재 운영 버전 공식 콜드 run03으로 채택 |

## 1. 파일과 개인정보 검증

- [x] raw HAR은 Git 제외 폴더에 보관했다.
- [x] raw HAR은 12,436,859 bytes, 요청 124개다.
- [x] raw HAR SHA-256: `EBC3533AA6DD2D03005930F31CE7C8FF9D2DA6AB73859A4FDD07EF6F92CFCBA3`
- [x] 개인정보 제거본의 이메일·인코딩 이메일·휴대폰·Bearer·쿠키·응답 본문·미가림 민감 필드·민감 URL 쿼리는 모두 0건이다.
- [x] 개인정보 제거본 SHA-256: `6679433AF8E59685C3ED85DD0DB6D0980700AE50ED4C4B5AFF1235718EFDFB8A`
- [x] 분석 JSON SHA-256: `520CB15D9A814D75943F4694367C7939A13B59F965718EB9D6673611CFB91457`

## 2. 배포 전 콜드 중앙값과 비교

| 지표 | 배포 전 중앙값 | 현재 버전 run03 | 변화 | 판정 |
|---|---:|---:|---:|---|
| 요청 수 | 121 | 124 | +2.5% | 허용 |
| DOMContentLoaded | 1,986ms | 1,777ms | -10.5% | 허용 |
| Load | 8,760ms | 8,905ms | +1.7% | 허용 |
| 페이지 자체 마지막 요청 | 19,016ms | 22,996ms | +20.9% | 자동 순환 영향 |
| 전체 전송량 | 5,524,351 | 5,185,908 bytes | -6.1% | 허용 |
| 이미지 전송량 | 3,486,938 | 3,130,525 bytes | -10.2% | 허용 |
| Cloud Function fetch | 6 | 6 | 0% | 동일 |
| 보조 일정 API 시작 | 8,757ms | 8,895ms | +1.6% | 허용 |
| 마지막 로그인 API 종료 | 11,650ms | 14,686ms | +26.1% | 중앙값 판정 필요 |
| MD PICK 지연 프리로드 | 16,705ms | 16,884ms | +1.1% | 허용 |

페이지 마지막 요청은 전송량이 작은 취향맞춤 자동 순환 배경 시점이므로 단독 회귀 지표로 사용하지 않는다. 초기 화면과 네트워크 무게는 기존 기준과 동등하다.

## 3. 로그인 API 타임라인

| 요청 | 시작 | 종료 | 소요 |
|---|---:|---:|---:|
| `home_bootstrap_light` | 1,677ms | 1,865ms | 188ms |
| 공개 `new_schedule_applications` | 8,895ms | 9,497ms | 602ms |
| 회원 `new_schedule_applications` | 8,896ms | 9,476ms | 580ms |
| `join_applications` | 12,098ms | 12,562ms | 464ms |
| `join_wishes_lookup` | 12,687ms | 13,197ms | 510ms |
| `home_stats` | 13,990ms | 14,686ms | 696ms |

공개 일정 응답 이후 `join_applications` 시작까지 약 2.60초 처리 구간이 세 번째로 반복됐다. `hydrateBuilderApplicationJoinsFromGoogleSheet()`의 행 병합·identity 계산·로컬 캐시 동기화·일정 upsert 구간이 후보지만 HAR만으로 원인을 확정하지 않는다.

## 4. 이미지와 마지막 요청

- [x] MD PICK 지연 상품이미지는 16.88초에 요청됐다.
- [x] 페이지 자체 마지막 요청은 23.00초의 `taste_bg3.webp`다.
- [x] HAR 저장 과정에서 25.44초에 발생한 `/mypage/member`는 페이지 자체 완료에서 제외했다.
- [x] `getEventTab.json` 27ms, `getEventGoodsList.json` 13ms로 병목이 아니다.
- [x] Supabase `productCC1.jpg` 실패가 다시 발생했다.

## 5. 판정

- [x] 현재 운영 버전 공식 콜드 run03으로 채택한다.
- [x] 현재 운영 코드의 공식 콜드 3회 수집을 완료했다.
- [ ] 3회 중앙값으로 배포 전 회귀와 2초대 처리 구간을 최종 판정한다.

