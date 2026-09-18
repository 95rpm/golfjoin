# 9단계 쓰기 후 정합성 최종 후보

## 전체 진행 체크리스트

- [x] 9-1 저장 응답에 최신 공개 일정·참여자 요약과 변경 revision 포함
- [x] 9-1 참여자 요약 동기화 실패를 성공으로 숨기거나 다른 저장 경로로 재저장하지 않도록 차단
- [x] 9-2 자동·수동 재시도에서 최초 application ID와 동일 payload 재사용
- [x] 9-2 같은 application ID의 동시 요청을 GCS generation 원자 잠금으로 직렬화
- [x] 9-3 성공 응답을 화면에 즉시 적용하고 로컬 mutation watermark 기록
- [x] 9-3 변경 전에 시작된 조회와 더 오래된 revision이 최신 화면을 덮어쓰지 못하도록 차단
- [x] 로컬 자동 회귀검사 완료
- [x] 서버 보강본 운영 배포 및 공개 읽기 API 상태 확인
- [x] `777AA240...` HTML 운영 배포 및 운영 회귀검사 38/38
- [x] 운영 A회원 생성 → B회원 참여 실사용 검증
- [x] 9단계 최종 통과 판정

## 초보자용 설명

일정 생성이나 참여 신청이 성공하면 서버는 이제 단순히 “저장됨”만 답하지 않습니다. 방금 저장된 일정의 현재인원, 모집상태, 화면에 공개해도 되는 참여자 아이콘 정보와 변경 시각을 함께 돌려줍니다. 브라우저는 이 답을 바로 화면에 사용하므로, 다시 조회가 끝날 때까지 과거 인원으로 보이는 시간을 줄입니다.

같은 순간에 오래된 조회가 늦게 도착해도 방금 저장한 결과를 덮어쓸 수 없습니다. 네트워크 문제로 사용자가 다시 누르는 경우에는 처음 만든 신청 번호를 그대로 재사용하고, 서버도 같은 신청 번호를 동시에 한 번만 처리하도록 잠급니다.

## 검증 결과

- 서버 전체: 113 passed, 0 failed
- 브라우저 단위: 75 passed, 0 failed
- 회원·딥링크·개인 캐시·A/B 참여자 PC/MO: 28 passed, 0 failed
- 네트워크 실패·지연 fallback PC/MO: 10 passed, 0 failed
- 비로그인 진입·스크롤·상품상세·상품군 기간 PC/MO: 8 passed, 0 failed
- HTML 소스 조립 검증: 일치
- 운영 공개 API: `home_bootstrap_light`, `home_stats` HTTP 200·CORS 정상·bootstrap 경고 0건

## 배포 후보

- 서버 원본: `server/google-sheet-proxy-function/index.js`
- 서버 업로드용 고유 사본: `server/google-sheet-proxy-function/stage9-final-index.js`
- 서버 테스트 원본: `server/google-sheet-proxy-function/write-consistency.test.js`
- 서버 테스트 업로드용 고유 사본: `server/google-sheet-proxy-function/stage9-final-write-consistency.js`
- HTML: `golfjoin_main.html`
- 서버 후보 SHA-256: `6046D6B48D9E335C45B9EC388E7A909B492C8A47B17983347AA91C46C0310177`
- Cloud Shell 줄바꿈 정규화 SHA-256: `3E186767EE7C432CDCB724068BD43A2C5EA9A93B89192B17DB1EC8F96FC76AD0`
- HTML SHA-256: `777AA240C9BF7E05C550F8A24CB8052BC38C8B4340839803247E1CD0A250D766`

## 복구 기준

- 직전 운영 HTML: `E454782A...`
- 로컬 복구 파일: `backups/home-optimization/phase9/golfjoin_main_before_phase9_E454782A.html`
- 서버 문제 발생 시 HTML을 먼저 배포하지 않고 Cloud Function을 직전 정상 소스로 재배포한다.
- HTML 문제 발생 시 위 복구 파일을 이벤트 페이지에 다시 적용한다.

## 운영 실사용 최종 결과

- A회원 2명 생성 직후·새로고침 후·내예약: 모두 2/4명 정상
- B회원 1명 참여 직후·상세·내예약·새로고침 후: 모두 3/4명 정상
- 참여자 아이콘: 3개, A `모임장`, B `나`
- 성별 구성: 남성 2명 / 여성 1명
- `new_schedule_applications` 대상 행: 1건
- `join_applications` 대상 행: 1건
- `schedule_participant_summary` 대상 행: 1건
- 원본·참여 goodSeq: `30001242` 일치
- 원본·참여 eventSeq: `30269529` 일치
- 캐시 우회 bootstrap: 3/4명, 남은 1자리, 아이콘 3개, 경고 0건
- 최종 판정: 9단계 통과
