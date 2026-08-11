# `8A853...` 모바일 로그인 웜 HAR 공식 run03

측정일: 2026-08-06 KST  
운영 URL: `https://m.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1`  
운영 소스 경계: `8A853CA11B9DED569067D2E45317B883E44452868E7FA8E01A2CCFAD6A17ACCC`

## 1. 최종 판정

- [x] 문서·CSS·JavaScript·이미지·Fetch를 포함한 요청 118개가 저장됐다.
- [x] 버전 홈 카드 JSON과 상품 대표이미지는 0 bytes로 재사용됐다.
- [x] 골프조인 API는 run01·run02와 같은 3개다.
- [x] literal `no-cache`는 동적 요청 중심 5개뿐이다.
- [x] 같은 HTML·로그인·모바일·캐시 조건의 공식 Warm run03으로 채택한다.
- [x] 공식 Warm 3회 중앙값·편차 계산에 포함한다.

## 2. 핵심 지표

| 지표 | run03 | 세 번의 중앙값 | 판정 |
|---|---:|---:|---|
| 요청 수 | 118개 | 118개 | 중앙값 일치 |
| 총 전송량 | 548,650 bytes | 548,650 bytes | 중앙값 일치 |
| DOMContentLoaded | 827ms | 827ms | 중앙값 일치 |
| Load | 4,244ms | 4,337ms | 중앙값보다 빠름 |
| 골프조인 API | 3개 | 3개 | 앱 캐시 재현 |
| 골프조인 핵심 API 종료 | 5,243ms | 5,333ms | 중앙값보다 빠름 |
| 상품 대표이미지 | 16개 | 16개 | 같은 구성 |
| 상품 대표이미지 전송 | 0 bytes | 0 bytes | HTTP 캐시 재현 |
| 홈 카드 완료 → MD PICK 이미지 | 3,004ms | 3,004ms | 중앙값 일치 |
| MD PICK 이미지 → `30001242` | 8,276ms | 8,276ms | 고정 지연 반복 |
| 중복 요청 그룹 | 0개 | 0개 | 정상 |
| Supabase status 0 | 1개 | 1개 | 지속 예외 후보 |

## 3. HTTP 캐시와 304 이미지 재검증

| 자산 | 결과 | 전송 |
|---|---|---:|
| 버전 홈 카드 | status 200, cache | 0 bytes |
| 홈 manifest | status 304 | 13 bytes |
| 상품군 manifest | status 304 | 13 bytes |
| 버전 상품군 catalog | status 304 | 13 bytes |
| CSS 9개 | cache | 0 bytes |
| JavaScript 40개 | cache | 0 bytes |
| 폰트 2개 | cache | 0 bytes |
| 상품 대표이미지 16개 | cache | 0 bytes |
| 골프조인 공용 이미지 26개 | status 304 | 대부분 12 bytes씩 |

run03에서는 골프조인 공용 이미지 26개가 조건부 재검증됐다. 요청 헤더에는 `no-cache`나 `max-age=0`이 없고 응답 정책은 `public, max-age=3600`이므로 강제 새로고침이 아니다. 브라우저가 기존 캐시의 신선도가 끝났다고 판단해 본문을 받지 않고 304로 유효성만 확인한 정상 경로다.

- [x] 26개 이미지 본문은 재다운로드되지 않았다.
- [x] 이미지 총 전송량은 356 bytes뿐이다. 이 중 312 bytes가 304 헤더 크기이고 44 bytes는 추적 이미지다.
- [!] 고정 URL 공용 이미지가 만료될 때 최대 26번의 네트워크 왕복이 생긴다.
- [!] 후속 단계에서 revision URL과 immutable 캐시 적용 여부를 검토한다.

## 4. 앱 캐시와 API 시점

| API | 시작 | 소요 | 종료 |
|---|---:|---:|---:|
| `home_bootstrap_light` | 721ms | 167ms | 888ms |
| 전체 `new_schedule_applications` | 4,764ms | 479ms | 5,243ms |
| 회원 `new_schedule_applications` | 4,764ms | 460ms | 5,224ms |

- [x] 회원 `join_applications`, `join_wishes_lookup`, `home_stats`는 실행되지 않았다.
- [x] 두 일정 API는 같은 시점에 병렬로 시작했다.
- [x] bootstrap 종료 → 일정 API 시작 공백은 3,876ms다.
- [x] 두 일정 API 모두 0.5초 안에 끝났다.

## 5. 대표이미지 시점

- 홈 카드 JSON 완료: 0.821초
- 첫 개인화 대표이미지 캐시 조회: 1.927초
- MD PICK 이미지 묶음 캐시 조회: 3.825초
- 홈 카드 완료 → MD PICK 이미지 묶음: 3.004초
- `goodSeq=30001242` 별도 캐시 조회: 12.101초

- [x] 상품 대표이미지 16개는 모두 0 bytes다.
- [x] 홈 카드 → MD PICK 지연은 3회 중앙값과 일치한다.
- [!] `goodSeq=30001242`는 주 이미지 묶음보다 8.276초 늦어 고정 타이머 경로가 세 번 모두 재현됐다.

## 6. 파일 무결성과 개인정보

| 파일 | 크기 | SHA-256 |
|---|---:|---|
| raw HAR | 12,756,505 bytes | `EAD946C5EBAB66275547BE86C704622375051E82E1C8E2897037387B61B9A264` |
| 개인정보 제거본 | 622,733 bytes | `86535B8DC0D9353513703BC492B1A3F225F895D1890C56D13442BFF57C37138D` |
| 안전 분석본 | 20,590 bytes | `B8BBF0F0867579B102136856475B6DA4AA874EED8F52582B0769DBD8FA0CDB3F` |

- [x] raw HAR은 `.gitignore` 대상이다.
- [x] 제거본의 미삭제 민감값, Cookie 값, 응답 본문, 요청 본문은 0건이다.
- [x] 이메일과 경계가 있는 국내 휴대전화 패턴은 0건이다.
- [x] 안전 분석본의 회원 식별 필드와 Cookie는 0건이다.
- [x] 제품 HTML은 수정하지 않았다.
- [x] 측정 전 HTML 해시는 두 번 모두 `8A853...`로 일치했다.

## 7. 다음 단계

- [x] 모바일 로그인 Warm 공식 run01·run02·run03 확보
- [x] 3회 중앙값·상대 범위 계산
- [ ] 비로그인 PC·모바일 기준선 측정
- [ ] Phase 0 운영·스테이징 복구 훈련

