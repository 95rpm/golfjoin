# `8A853...` PC 비로그인 Cold HAR 공식 run01

측정일: 2026-08-06 KST  
운영 URL: `https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`  
운영 소스 경계: `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC`

## 1. 최종 판정

- [x] PC·비로그인·`Disable cache` 조건의 전체 요청 122개가 저장됐다.
- [x] 골프조인 API에는 회원 식별 쿼리가 없다.
- [x] `home_bootstrap_light`와 `home_stats`만 실행됐다.
- [x] 개인정보 제거본과 안전 분석본을 생성했다.
- [x] 공식 PC 비로그인 Cold run01로 채택한다.
- [ ] 같은 조건 run02·run03으로 반복성과 중앙값을 확정한다.

## 2. 핵심 지표

| 지표 | run01 |
|---|---:|
| 요청 수 | 122개 |
| 총 전송량 | 5,997,156 bytes |
| DOMContentLoaded | 1,734ms |
| Load | 9,611ms |
| 전체 기록 | 19,053ms |
| 이미지 요청·전송 | 54개·3,983,725 bytes |
| JavaScript 전송 | 1,095,408 bytes |
| 상품 대표이미지 | 14개·1,329,351 bytes |
| 골프조인 API | 2개 |
| 중복 요청 그룹 | 0개 |
| status 0 | 1개 |

전체 전송량의 약 66.4%가 이미지이고 약 18.3%가 JavaScript다. 상품 대표이미지만 약 1.27MiB다.

## 3. 홈 데이터와 대표이미지 시점

| 단계 | 시점·소요 |
|---|---:|
| 홈 카드 JSON 완료 | 1,884ms |
| 첫 대표이미지 요청 | 8,956ms |
| 홈 카드 완료 → 첫 대표이미지 | 7,072ms |
| 첫 이미지 묶음 7개 | 8,956ms |
| 두 번째 묶음 3개 | 13,983ms |
| 세 번째 묶음 1개 | 16,961ms |
| 네 번째 묶음 3개 | 19,002ms |
| 마지막 대표이미지 완료 | 19,030ms |
| 개별 이미지 최대 소요 | 45ms |

- [x] 홈 카드 데이터는 약 1.88초에 준비됐다.
- [!] 첫 대표이미지 요청은 데이터 준비 뒤 약 7.07초 늦다.
- [!] 대표이미지 14개가 한 번에 요청되지 않고 네 묶음으로 나뉘어 약 10.05초 동안 추가된다.
- [x] 개별 이미지 다운로드는 최대 약 45ms로 빠르다.

따라서 대표이미지 서버가 느린 것이 아니라 타이머·idle·후속 렌더가 요청 자체를 늦추는 것이 주원인이다.

## 4. 비로그인 API 시점

| API | 시작 | 소요 | 종료 |
|---|---:|---:|---:|
| `home_bootstrap_light` | 1,656ms | 238ms | 1,894ms |
| `home_stats` | 8,985ms | 1,427ms | 10,412ms |

- [x] 회원용 `new_schedule_applications`, `join_applications`, 찜 조회는 실행되지 않았다.
- [x] 모든 골프조인 API URL에 `memberKey`, `memberSeq`, `memberId`가 없다.
- [!] bootstrap 종료 → `home_stats` 시작 공백은 7,091ms다.
- [!] `home_stats` 서버 대기 시간도 약 1.33초다.

## 5. 원홈페이지 XHR 확인

| 요청 | 소요 | 전송 |
|---|---:|---:|
| `getEventTab.json?eventPlanSeq=3` | 17ms | 339 bytes |
| `getEventGoodsList.json?eventPlanSeq=3&tabSeq=1` | 14ms | 220 bytes |

- [x] 두 요청은 `www.secret-tour.com/event/...`에서 실행되는 원홈페이지 XHR이다.
- [x] 합계 약 31ms·559 bytes로 현재 메인 지연의 원인이 아니다.

## 6. 반복 확인 대상

- 대표이미지 첫 요청 지연 약 7초
- 대표이미지 네 단계 분할 요청
- bootstrap → `home_stats` 공백 약 7초
- `home_stats` 1초대 서버 응답
- Supabase `productCC1.jpg` status 0

## 7. 파일 무결성과 개인정보

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| raw HAR | 13,440,424 bytes | `C84FD15F3AAE5A1E550C91FC225EAA6A97AFA2B84643CC5EDEF394CE7263E48B` |
| 개인정보 제거본 | 797,631 bytes | `07A46900FEDC1FA3911791AF4D8B7BF51B5C12C64FBB26C3E9532FD9F6FF4582` |
| 안전 분석본 | 18,746 bytes | `13E00477275F0C508B0B92D6CC7A42AF35664CDDE76372502DE582700D2F743B` |

- [x] raw HAR은 `.gitignore` 대상이다.
- [x] 제거본의 미삭제 민감값, Cookie 값, 요청·응답 본문은 0건이다.
- [x] 이메일·국내 휴대전화·회원 식별 필드는 0건이다.
- [x] 제품 HTML은 수정하지 않았다.
- [x] 측정 전 HTML 해시는 두 번 모두 `8A853...`로 일치했다.

## 8. 다음 단계

- [x] PC 비로그인 Cold 공식 run01
- [ ] PC 비로그인 Cold 공식 run02
- [ ] PC 비로그인 Cold 공식 run03
- [ ] 3회 중앙값·상대 범위 확정

