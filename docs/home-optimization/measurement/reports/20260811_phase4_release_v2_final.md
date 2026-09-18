# 4단계 Release manifest V2 운영 검증 최종 보고서

## 최종 결론

- [x] Cloud Function 배포 완료
- [x] 최초 상태 `exists: false` 확인
- [x] 운영 발행본 2개 생성 및 독립 검증
- [x] 첫 발행본으로 실제 롤백 검증
- [x] 두 번째 최신 발행본으로 재복원
- [x] 운영 브라우저 사용 OFF 확인
- [x] 4단계 통과 조건 전체 완료

쉽게 말하면 홈 데이터 다섯 묶음을 하나의 배송 단위로 안전하게 발행하고, 문제가 있으면 직전 정상 배송 단위로 되돌리는 장치를 실제 운영 저장소에서 시험했다. 현재 고객 페이지는 아직 이 새 배송 단위를 읽지 않는다.

## 발행 리비전

| 구분 | 리비전 |
|---|---|
| 첫 번째 정상 발행본 | `gjr_fb3ac1f36868bee34415667c` |
| 두 번째 최신 발행본 | `gjr_d8aea4db552acdda711baaea` |
| 최종 활성 발행본 | `gjr_d8aea4db552acdda711baaea` |
| 최종 직전 정상 발행본 | `gjr_fb3ac1f36868bee34415667c` |
| 최종 root generation | `1786420908109365` |

## 첫 발행에서 발견하고 차단한 실제 데이터 문제

첫 발행은 운영 대표 홈 카드 150개에 `status`가 없어서 `homeCardsV2` 계약 단계에서 중단됐다. 계약 검증이 객체 업로드보다 먼저 실행되어 root manifest는 생성되지 않았고 공개 GCS에서 404를 확인했다.

기존 고객용 `golfjoin_home_cards.json`의 구조와 화면 동작은 바꾸지 않았다. Release V2 발행 변환에서만 이미 날짜·가격·마감 검사를 통과한 대표 카드의 빈 상태를 `available`로 정규화했다.

- [x] 운영 대표 카드 150개 정규화
- [x] 수정 후 `homeCardsV2` 계약 오류 0건
- [x] Release V2 전용 범위 적용
- [x] 로컬 서버 테스트 92/92 통과

## 운영 GCS 검증

| 검사 | 결과 |
|---|---|
| root manifest | HTTP 200 |
| 활성 불변 archive | HTTP 200 |
| 직전 정상 불변 archive | HTTP 200 |
| root 객체 수 | 5개 |
| 객체 누락 | 0건 |
| 객체 release ID 불일치 | 0건 |
| 객체 snapshot watermark 불일치 | 0건 |
| 객체 캐시 | `public, max-age=31536000, immutable` |
| 가용일 저장 인코딩 | GCS stored encoding `gzip` |
| 브라우저 사용 플래그 | `false` |

최종 활성 객체의 하위 리비전은 다음과 같다.

| 역할 | 리비전 |
|---|---|
| 홈 정적 카드 | `ghc_aa337bbe9d31f76b7c09effe` |
| 실시간 홈 데이터 | `ghl_b9dfe01f8a442b70f5ab460a` |
| 상품군 | `pfc_549a82879c8323031a3e7f76` |
| 출발 가능일 | `gpa_8efb6e29decc5ed8efe8d9c5` |
| 상품상세 준비 상태 | `gpdi_6836c897b05627825a621653` |

## 롤백 시험

1. 두 번째 발행본에서 첫 번째 발행본으로 전환했다.
2. 활성 리비전, `previousStableRevision`, `rollbackFromRevision`을 확인했다.
3. 롤백된 발행본의 객체 5개를 모두 다시 읽어 검증했다.
4. 두 불변 archive가 모두 보존됐는지 확인했다.
5. 두 번째 최신 발행본으로 다시 전환해 원래 최신 상태를 복원했다.

- [x] 데이터 삭제 없이 root 포인터만 전환
- [x] 롤백 후 객체 오류 0건
- [x] 최신 발행본 재복원 후 객체 오류 0건

## 기존 운영 경로 무영향 확인

- [x] PC 운영 HTML HTTP 200
- [x] MO 운영 HTML HTTP 200
- [x] PC HTML의 `release-manifest-v2` 참조 0건
- [x] MO HTML의 `release-manifest-v2` 참조 0건
- [x] PC·MO HTML의 관리자 Release action 참조 0건
- [x] `home_bootstrap_light` POST 200, JSON 오류 없음
- [x] `home_stats` POST 200, JSON 오류 없음

## 다음 단계

5단계에서는 기존 데이터와 Release V2 데이터를 화면에 사용하지 않은 채 비교한다. 사용자 화면 전환은 6단계 전까지 하지 않는다.

- [ ] 핵심 필드 비교 실행기 확정
- [ ] 개인정보 없는 hash 기반 비교 로그 확정
- [ ] 누락 상품·일정·상품군 0건 확인
- [ ] 충분한 발행 횟수 또는 최소 7일 동안 안정성 확인
