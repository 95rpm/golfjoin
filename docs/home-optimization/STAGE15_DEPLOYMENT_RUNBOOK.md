# 15단계 일반회원 SMS 인증 배포·복구 실행서

> 현재 상태 안내(2026-08-21): 이 문서는 SMS 인증을 처음 선배포한 당시의 실행서다. 아래의 `Gate=off` 요구는 카카오 회원용 토큰 교환이 없었던 15단계 초기 배포에만 적용된다. 이후 카카오 공식 access token 서버 검증, HMAC Report, Enforce 전환과 복구시험을 완료했으며 현재 운영 기준은 `STAGE30_MEMBER_AUTH_GATE_ROLLOUT.md`의 `golfjoin-sheet-api-00231-yuz`, Gate `enforce`다. 이 문서의 예전 리비전과 Gate 값으로 현재 운영을 덮어쓰지 않는다.

## 현재 목표

모든 일반 아이디(HOME) 로그인 회원에게 SMS 인증을 적용한다. 신규 일반회원 가입에는 휴대폰 인증을 적용하고, 카카오 회원은 기존 로그인 흐름을 유지한다. 인증 성공 세션은 24시간 유지하며 로그인·가입 인증번호는 모두 3분 동안 유효하다.

당시 중요 조건: 서버 보호 수준은 `GOLFJOIN_MEMBER_AUTH_GATE=off`로 유지했다. 당시에는 카카오 회원이 GolfJoin 회원 토큰을 발급받지 못했기 때문이다. 이 조건은 Stage 30 완료로 대체됐으며 현재 운영 Gate는 `enforce`다.

배포 패키지:

`deploy/stage15-sms-member-auth/all-home-server-memberseq-20260818-v13`

운영 HTML: `DEPLOY_golfjoin_main_sms_auth_AFCF6114.html`  
운영 자산 revision: `gha_014be8793c73b6cf34d3ea6b`  
즉시 화면 복구본: `ROLLBACK_golfjoin_main_9CE144E0.html`

## 전체 체크리스트

- [x] 1. 알리고 실문자 발송·수신 확인
- [x] 2. 서버 OTP·토큰·횟수 제한 구현
- [x] 3. 일반 로그인 OTP UI와 토큰 세션 연결
- [x] 4. 전체 서버·메인 자동검사 통과
- [x] 5. 제한회원 배포본과 현재 운영 복구본 생성
- [x] 6. 비공개 GCS 인증 버킷 생성
- [x] 7. 운영 환경변수의 인증 세션을 24시간으로 갱신
- [x] 8. 신규가입 휴대폰 인증 서버·UI 구현 및 로컬 검증
- [x] 9. 보완 메인 함수를 배포
- [x] 10. 신규 CSS·JavaScript 불변 객체 업로드
- [x] 11. 테스트 이벤트 27에서 일반회원 실인증과 신규가입 검증
- [x] 12. 일반회원·카카오회원·비로그인 회귀 확인
- [x] 13. 운영 HTML `AFCF6114` 배포
- [x] 14. 즉시 복구 절차와 복구 파일 확인 — 실제 트래픽 복구 전환 시험은 별도 잔여 항목

## 1. 비공개 인증 버킷 생성

Cloud Shell에서 실행한다. 이 버킷에는 인증번호 원문이 아니라 HMAC, 시도 횟수, 만료시각, 세션 해시만 저장한다.

```bash
PROJECT_ID="golfjoin-499602"
REGION="asia-northeast3"
MEMBER_AUTH_BUCKET="golfjoin-member-auth-499602"

RUNTIME_SA="$(gcloud functions describe golfjoin-sheet-api \
  --gen2 \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(serviceConfig.serviceAccountEmail)')"

if [ -z "${RUNTIME_SA}" ]; then
  echo "golfjoin-sheet-api 실행 서비스 계정을 찾지 못했습니다."
  exit 1
fi

if gcloud storage buckets describe "gs://${MEMBER_AUTH_BUCKET}" \
  --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "기존 인증 버킷을 사용합니다: ${MEMBER_AUTH_BUCKET}"
else
  gcloud storage buckets create "gs://${MEMBER_AUTH_BUCKET}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --uniform-bucket-level-access \
    --public-access-prevention \
    --soft-delete-duration=0
fi

gcloud storage buckets update "gs://${MEMBER_AUTH_BUCKET}" \
  --project="${PROJECT_ID}" \
  --uniform-bucket-level-access \
  --public-access-prevention \
  --clear-cors

gcloud storage buckets add-iam-policy-binding "gs://${MEMBER_AUTH_BUCKET}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/storage.objectAdmin" \
  --condition=None

printf '%s\n' \
  '{"rule":[{"action":{"type":"Delete"},"condition":{"age":2}}]}' \
  > /tmp/golfjoin-member-auth-lifecycle.json

gcloud storage buckets update "gs://${MEMBER_AUTH_BUCKET}" \
  --project="${PROJECT_ID}" \
  --lifecycle-file=/tmp/golfjoin-member-auth-lifecycle.json
```

확인한다.

```bash
gcloud storage buckets describe "gs://${MEMBER_AUTH_BUCKET}" \
  --project="${PROJECT_ID}" \
  --format='yaml(name,location,iamConfiguration.uniformBucketLevelAccess.enabled,iamConfiguration.publicAccessPrevention,lifecycle)'

gcloud storage buckets get-iam-policy "gs://${MEMBER_AUTH_BUCKET}" \
  --project="${PROJECT_ID}" \
  --format=json
```

기대 결과:

- `uniformBucketLevelAccess.enabled: true`
- `publicAccessPrevention: enforced`
- `allUsers`, `allAuthenticatedUsers` 없음
- 런타임 서비스 계정에 `roles/storage.objectAdmin` 존재
- 2일 경과 객체 삭제 규칙 존재

## 2. 메인 함수 환경변수 추가

아래 스크립트는 기존 환경변수를 보존하고 인증 항목만 추가·갱신한다. 기존에 안전한 인증 비밀이 있으면 그대로 보존하며, 없을 때만 새 비밀을 생성한다. 비밀값은 화면에 출력하지 않는다.

```bash
export ENV_FILE="/home/llno95ll/golfjoin-sheet-api.env.yaml"
export MEMBER_AUTH_BUCKET="golfjoin-member-auth-499602"

python3 <<'PY'
import json
import os
import re
import secrets
import stat
from pathlib import Path

path = Path(os.environ["ENV_FILE"])
bucket = os.environ["MEMBER_AUTH_BUCKET"]
source = path.read_text(encoding="utf-8")

def current_value(name):
    match = re.search(rf"^{re.escape(name)}:\s*(.*)$", source, re.MULTILINE)
    if not match:
        return ""
    value = match.group(1).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    return value

secret = current_value("GOLFJOIN_MEMBER_AUTH_SECRET")
if len(secret.encode("utf-8")) < 32:
    secret = secrets.token_urlsafe(48)

updates = {
    "GOLFJOIN_MEMBER_AUTH_ENABLED": "Y",
    "GOLFJOIN_MEMBER_AUTH_GATE": "off",
    "GOLFJOIN_MEMBER_AUTH_SECRET": secret,
    "GOLFJOIN_MEMBER_AUTH_BUCKET": bucket,
    "GOLFJOIN_MEMBER_AUTH_PREFIX": "member-auth/v1",
    "GOLFJOIN_MEMBER_OTP_TTL_SECONDS": "180",
    "GOLFJOIN_MEMBER_ACCESS_TTL_SECONDS": "300",
    "GOLFJOIN_MEMBER_SESSION_TTL_SECONDS": "86400",
    "GOLFJOIN_MEMBER_SIGNUP_OTP_TTL_SECONDS": "180",
}

lines = source.splitlines()
seen = set()
result = []
for line in lines:
    match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*):", line)
    key = match.group(1) if match else ""
    if key in updates:
        result.append(f"{key}: {json.dumps(updates[key])}")
        seen.add(key)
    else:
        result.append(line)

for key, value in updates.items():
    if key not in seen:
        result.append(f"{key}: {json.dumps(value)}")

mode = stat.S_IMODE(path.stat().st_mode)
temp = path.with_name(path.name + ".stage15.tmp")
temp.write_text("\n".join(result) + "\n", encoding="utf-8")
os.chmod(temp, mode)
os.replace(temp, path)

print("회원 인증 환경변수 9개를 설정했습니다. 비밀값은 출력하지 않았습니다.")
PY

unset ENV_FILE MEMBER_AUTH_BUCKET
```

키 이름만 확인한다. 값을 통째로 출력하지 않는다.

```bash
awk -F: '/^GOLFJOIN_MEMBER_(AUTH|OTP|ACCESS|SESSION)/ { print $1 ": [configured]" }' \
  /home/llno95ll/golfjoin-sheet-api.env.yaml
```

## 3. 서버 파일 업로드·해시 확인·교체

다음 일곱 파일을 패키지에서 Cloud Shell의 `/home/llno95ll/google-sheet-proxy-function`으로 업로드한다.

- `stage15-index.js`
- `stage15-member-sms-auth.js`
- `stage15-member-sms-auth.test.js`
- `stage15-member-sms-auth-browser.test.js`
- `stage15-member-sms-auth-integration.test.js`
- `stage15-private-cache-control.test.js`
- `stage15-configure-env.py`

그다음 실행한다.

```bash
cd /home/llno95ll/google-sheet-proxy-function

check_hash() {
  actual="$(sha256sum "$1" | awk '{print $1}')"
  if [ "$actual" != "$2" ]; then
    echo "해시 불일치: $1"
    return 1
  fi
  echo "정상: $1"
}

check_hash stage15-index.js b393d0c0d5742145eba1eeb340586a6ae9b3b523ac1dc52554587b42e3246de8 &&
check_hash stage15-member-sms-auth.js 167f202cfcd2497544cb6055ce070afe346af7e5ac7fa22b42c764e9ee1492cf &&
check_hash stage15-member-sms-auth.test.js ff49e9452d5c0736fc44d0191be4a2f62e4f15bfb8be90380bd6c13f83cf3374 &&
check_hash stage15-member-sms-auth-browser.test.js 3ff9d4f116911bb74f7658ad796897ebd8fde1e6ff671ffcbaf3a588fb4dc972 &&
check_hash stage15-member-sms-auth-integration.test.js 6af62c4e31ae021d827b7164d0abd54d98be0288fe3a537d22a810403e7a7d5c &&
check_hash stage15-private-cache-control.test.js 469ff388e599450d8ee8250121c53cba6dbe461446fc326b56fc064ef12c16be &&
check_hash stage15-configure-env.py 85afbf1e5a4a81c63db91af22aea963695d8054ab040e8ff236447ada8631b1c &&
cp -f stage15-index.js index.js &&
cp -f stage15-member-sms-auth.js member-sms-auth.js &&
cp -f stage15-member-sms-auth.test.js member-sms-auth.test.js &&
cp -f stage15-member-sms-auth-browser.test.js member-sms-auth-browser.test.js &&
cp -f stage15-member-sms-auth-integration.test.js member-sms-auth-integration.test.js &&
cp -f stage15-private-cache-control.test.js private-cache-control.test.js &&
cmp -s stage15-index.js index.js &&
cmp -s stage15-member-sms-auth.js member-sms-auth.js &&
echo "15단계 서버 파일 교체 완료"
```

## 4. 배포 직전 검사와 이전 리비전 기록

```bash
cd /home/llno95ll/google-sheet-proxy-function

node --check index.js &&
node --check member-sms-auth.js &&
node --test member-sms-auth.test.js member-sms-auth-browser.test.js member-sms-auth-integration.test.js private-cache-control.test.js &&
npm test
```

모두 통과한 경우에만 이전 리비전을 기록한다.

```bash
PREVIOUS_SHEET_REVISION="$(gcloud run services describe golfjoin-sheet-api \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --format='value(status.latestReadyRevisionName)')"

PREVIOUS_ALIGO_REVISION="$(gcloud run services describe golfjoin-aligo-api \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --format='value(status.latestReadyRevisionName)')"

printf 'PREVIOUS_SHEET_REVISION=%s\nPREVIOUS_ALIGO_REVISION=%s\n' \
  "$PREVIOUS_SHEET_REVISION" "$PREVIOUS_ALIGO_REVISION"
```

두 값을 별도로 보관한다. 비밀값은 아니다.

## 5. 서버 함수 순차 배포

OTP 문자 전송 액션을 먼저 받을 수 있도록 Aligo 비공개 함수를 먼저 배포하고 메인 함수를 뒤에 배포한다.

```bash
cd /home/llno95ll/google-sheet-proxy-function
export VPC_CONNECTOR="golfjoin-vpc-connector"

gcloud functions deploy golfjoin-aligo-api \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --source=. \
  --entry-point=proxyGoogleSheet \
  --trigger-http \
  --timeout=300s \
  --cpu=1 \
  --memory=1GiB \
  --min-instances=0 \
  --max-instances=3 \
  --concurrency=5 \
  --no-allow-unauthenticated \
  --vpc-connector="${VPC_CONNECTOR}" \
  --egress-settings=all \
  --env-vars-file=/home/llno95ll/golfjoin-aligo-api.env.yaml &&
gcloud functions deploy golfjoin-sheet-api \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --source=. \
  --entry-point=proxyGoogleSheet \
  --trigger-http \
  --timeout=540s \
  --memory=1GiB \
  --allow-unauthenticated \
  --env-vars-file=/home/llno95ll/golfjoin-sheet-api.env.yaml

unset VPC_CONNECTOR
```

확인한다.

```bash
gcloud functions describe golfjoin-aligo-api \
  --gen2 --region=asia-northeast3 --project=golfjoin-499602 \
  --format='yaml(state,updateTime,serviceConfig.uri)'

gcloud functions describe golfjoin-sheet-api \
  --gen2 --region=asia-northeast3 --project=golfjoin-499602 \
  --format='yaml(state,updateTime,serviceConfig.uri,serviceConfig.environmentVariables.GOLFJOIN_MEMBER_AUTH_ENABLED,serviceConfig.environmentVariables.GOLFJOIN_MEMBER_AUTH_GATE,serviceConfig.environmentVariables.GOLFJOIN_MEMBER_AUTH_BUCKET)'
```

기대값은 `ENABLED=Y`, `GATE=off`, 인증 전용 버킷 이름이다. 비밀 환경변수는 조회하지 않는다.

## 6. 신규 외부 자산 업로드

패키지의 다음 두 파일을 Cloud Shell에 업로드하고 패키지 폴더에서 실행한다.

```bash
gcloud storage cp UPLOAD_golfjoin-main_EFD7A2B4.css.gz \
  gs://golfjoin-bucket/web/home-assets/gha_d2af3333f71a2d0e8c17a80a/golfjoin-main.css \
  --if-generation-match=0 \
  --content-type="text/css; charset=utf-8" \
  --content-encoding=gzip \
  --cache-control="public, max-age=31536000, immutable"

gcloud storage cp UPLOAD_golfjoin-main_4CE58FA7.js.br \
  gs://golfjoin-bucket/web/home-assets/gha_d2af3333f71a2d0e8c17a80a/golfjoin-main.js \
  --if-generation-match=0 \
  --content-type="application/javascript; charset=utf-8" \
  --content-encoding=br \
  --cache-control="public, max-age=31536000, immutable"
```

응답 헤더를 확인한다.

```bash
curl -sSI -H "Accept-Encoding: gzip" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/gha_d2af3333f71a2d0e8c17a80a/golfjoin-main.css
curl -sSI -H "Accept-Encoding: br" https://storage.googleapis.com/golfjoin-bucket/web/home-assets/gha_d2af3333f71a2d0e8c17a80a/golfjoin-main.js
```

CSS는 `Content-Encoding: gzip`, JavaScript는 `Content-Encoding: br`, 둘 다 `Cache-Control: public, max-age=31536000, immutable`이어야 한다.

## 7. 테스트 이벤트 25 검증

`eventPlanSeq=25`의 전체 HTML을 최신 수정본 `DEPLOY_golfjoin_main_sms_auth_336C0E80.html` 내용으로 교체한다.

### 7-1. 기존 이용자 회귀 확인

- [x] 비로그인: 메인 진입, 추천여행, 취향맞춤, 상품상세, 스크롤 정상
- [x] 카카오 회원: 기존처럼 로그인되고 SMS 화면과 `member_auth` 요청이 나오지 않음
- [x] 일반회원: 모두 SMS 인증 후 로그인되고 24시간 세션이 유지됨
- [x] 내예약·나의모임·모임생성·참여신청 기존 동작 정상

### 7-2. 제한 일반회원 실제 인증

1. 테스트 일반회원 `30002219`를 로그아웃한다.
2. 개발자 도구 Network를 열고 요청 목록을 지운다.
3. 일반 아이디와 비밀번호로 로그인한다.
4. `/member/getMemberLoginCheck.json`이 200 `SUCCESS`인지 확인한다.
5. `member_auth_start`가 202이고 화면이 `휴대폰 인증`으로 전환되는지 확인한다.
6. 등록 휴대폰 끝 4자리 안내와 3분 타이머가 보이는지 확인한다.
7. 실제 받은 6자리 번호를 입력한다.
8. `member_auth_verify`가 200인지 확인한다.
9. 메인으로 복귀하고 나의모임·내예약이 정상인지 확인한다.
10. 회원 전용 Cloud Function 요청의 Request Headers에 `Authorization: Bearer ...`가 붙는지 확인한다.
11. URL·쿼리스트링·Console에는 인증번호와 토큰이 없어야 한다.

주의: Bearer 토큰은 요청 헤더와 인증 응답 본문에는 나타나는 것이 정상이다. 화면을 캡처하거나 다른 사람에게 공유하지 않는다.

### 7-3. 신규 일반회원 휴대폰 인증

1. 아직 가입하지 않은 일반회원 정보로 회원가입을 시작한다.
2. 회원정보 입력 단계에서 휴대폰 번호 오른쪽 `인증하기`를 누른다.
3. `member_signup_phone_start`가 202이고 문자 1건이 수신되는지 확인한다.
4. 인증번호 입력 영역이 약 70%, 확인 버튼이 약 30%이며 타이머가 `03:00`부터 감소하는지 확인한다.
5. 받은 6자리 번호를 입력하고 `인증하기`를 누른다.
6. `member_signup_phone_verify`가 200인지 확인한다.
7. 인증번호 입력 행이 사라지고 휴대폰 입력 필드 오른쪽에 `인증완료` 배지가 보이는지 확인한다.
8. 휴대폰 번호 한 자리를 바꾸면 인증완료가 즉시 취소되는지 확인한다.
9. 다시 인증한 뒤 가입을 완료하고 `member_signup_phone_assert`, `member_signup_phone_complete`가 각각 200인지 확인한다.
10. 가입 직후 로그인 인증 문자가 한 번 더 발송되지 않고 메인페이지 로그인 상태가 되는지 확인한다.

### 7-4. 실패 흐름

- [x] 틀린 인증번호 1회: HTTP 401 `member_otp_invalid`, 남은 횟수 4회 안내, 로그인 완료되지 않음 — eventPlanSeq 28 운영 시험
- [x] 틀린 번호 1회 뒤 같은 요청의 올바른 번호를 입력하면 `member_auth_verify` HTTP 200으로 정상 복구 — eventPlanSeq 28 운영 시험
- [ ] 60초 전 재전송 버튼: 비활성
- [ ] 60초 후 재전송: 새 문자 수신, 이전 번호 사용 불가
- [ ] OTP 시작 서버 실패: 시크릿투어 로그인도 자동 취소되고 다시 로그인 안내
- [ ] 로그아웃: 탭 인증 세션 삭제
- [ ] 새 탭: 기존 탭의 인증 세션이 자동 복사되지 않음

## 8. 운영 제한 배포

테스트 이벤트의 PC·모바일 검사가 모두 정상일 때만 현재 운영 이벤트 HTML을 `DEPLOY_golfjoin_main_sms_auth_336C0E80.html` 전체 내용으로 교체한다.

배포 직후 다음을 다시 확인한다.

- [x] 비로그인 메인·스크롤·상품상세
- [x] 카카오 회원 로그인·나의모임·내예약
- [x] 일반회원 SMS 인증·나의모임·내예약
- [x] 신규 일반회원 가입 휴대폰 인증·가입 완료·새로고침 시 추가 문자 미발송
- [x] 빈 `memberSeq` 일반회원 ERP 재확인·SMS 인증·로그인
- [x] Console 신규 오류 없음
- [x] CSS/JavaScript HTTP 200, SRI 오류 없음

## 9. 즉시 복구

### 화면 또는 외부 자산 문제

운영 이벤트의 전체 HTML을 `ROLLBACK_golfjoin_main_9CE144E0.html`로 교체한다. 신규 GCS 불변 객체는 삭제하지 않는다.

### 신규 서버 리비전 문제

4단계에서 기록한 실제 이전 리비전 이름을 넣는다.

```bash
gcloud run services update-traffic golfjoin-sheet-api \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --to-revisions=PREVIOUS_SHEET_REVISION=100

gcloud run services update-traffic golfjoin-aligo-api \
  --region=asia-northeast3 \
  --project=golfjoin-499602 \
  --to-revisions=PREVIOUS_ALIGO_REVISION=100
```

### 인증 기능만 중지

메인 환경파일의 `GOLFJOIN_MEMBER_AUTH_ENABLED`를 `N`, `GOLFJOIN_MEMBER_AUTH_GATE`를 `off`로 바꾸고 `golfjoin-sheet-api`를 같은 명령으로 재배포한다. 화면은 먼저 `9CE144E0` 복구본으로 돌리면 제한 회원도 즉시 기존 로그인으로 돌아간다.

## 공식 명령 근거

- Cloud Storage 버킷 생성·Uniform access·Public access prevention: Google Cloud `gcloud storage buckets create`
- 수명주기·CORS·Public access prevention 갱신: Google Cloud `gcloud storage buckets update`
- 버킷 IAM: Google Cloud `gcloud storage buckets add-iam-policy-binding`
- 함수 배포 옵션: Google Cloud `gcloud functions deploy`
- 이전 리비전 복구: Google Cloud `gcloud run services update-traffic`
