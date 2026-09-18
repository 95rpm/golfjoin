# 공개 메인 장애 fallback E2E 기록

## 결론

공개 메인의 핵심 정적 데이터와 bootstrap 경로에 네트워크 실패, HTTP 500, 3초 지연, manifest 참조 누락, 잘못된 JSON을 각각 주입했다. PC와 모바일 모두 기존 카드 또는 전체 홈 요약 경로로 복구했으며 메인 카드, 초기 로딩 종료, 세로 스크롤 가능 상태를 유지했다.

테스트는 브라우저가 받는 응답만 바꿨다. 운영 GCS 객체, Cloud Function, 시트 데이터는 수정하지 않았다.

## 검사 시나리오

### 1. 상품군 manifest 네트워크 실패

- `web/product-family/manifest.json` 요청을 브라우저에서 중단한다.
- 상품군 정보가 없어도 공개 MD PICK 카드와 메인 스크롤이 유지되는지 확인한다.

### 2. `home_bootstrap_light` HTTP 500

- 해당 요청만 HTTP 500 JSON으로 바꾼다.
- 정적 홈 카드와 저장된 공개 스냅샷 fallback 후 메인이 정상화되는지 확인한다.

### 3. `home_bootstrap_light` 3초 지연

- 요청을 최소 2.9초 이상 보류한 뒤 실제 API로 진행한다.
- 응답 후 초기 로딩과 전역 로딩이 남지 않는지 확인한다.

### 4. 홈 manifest 참조 누락

- 브라우저가 받은 manifest의 활성 카드 주소를 테스트용 404 주소로 바꾼다.
- 버전 카드 실패 후 기존 `golfjoin_home_cards.json`으로 복구되는지 확인한다.

### 5. 잘못된 홈 카드 JSON

- 버전 카드와 기존 홈 카드 응답을 문법 오류 JSON으로 바꾼다.
- 전체 `golfjoin_home_summary.json` 경로가 호출되고 공개 메인이 복구되는지 확인한다.

## 공통 통과 조건

- [x] 골프조인 루트 표시
- [x] MD PICK 카드 1개 이상
- [x] `homeInitialLoadingOverlay` 종료
- [x] 문서 높이가 화면보다 크고 실제 세로 스크롤 가능
- [x] `joinActionLoadingOverlay`가 열린 채 남지 않음
- [x] PC 5/5
- [x] 모바일 5/5
- [x] 전체 10/10

## 실행 명령

```powershell
cd D:\secrettour_join\260521\golfjoin
npm.cmd run test:e2e:fallback
```

## 보안·운영 경계

- 로그인 쿠키, 회원키, 휴대폰, 이메일을 사용하거나 기록하지 않는다.
- 운영 쓰기 API를 호출하지 않는다.
- 테스트용 오류 문자열은 브라우저 응답 안에서만 사용한다.
- 실패 trace와 screenshot은 `test-results/` 아래에만 저장하며 Git에서 제외한다.
