import json
import os
import re
import secrets
import stat
from pathlib import Path


ENV_FILE = Path(
    os.environ.get(
        "GOLFJOIN_STAGE15_ENV_FILE",
        "/home/llno95ll/golfjoin-sheet-api.env.yaml",
    )
)
MEMBER_AUTH_BUCKET = os.environ.get(
    "GOLFJOIN_STAGE15_MEMBER_AUTH_BUCKET",
    "golfjoin-member-auth-499602",
)


if not ENV_FILE.exists():
    raise SystemExit(f"환경변수 파일을 찾지 못했습니다: {ENV_FILE}")

source = ENV_FILE.read_text(encoding="utf-8")


def current_value(name):
    match = re.search(
        rf"^{re.escape(name)}:\s*(.*)$",
        source,
        re.MULTILINE,
    )
    if not match:
        return ""

    value = match.group(1).strip()
    if (
        len(value) >= 2
        and value[0] == value[-1]
        and value[0] in "\"'"
    ):
        value = value[1:-1]
    return value


secret = current_value("GOLFJOIN_MEMBER_AUTH_SECRET")
if len(secret.encode("utf-8")) < 32:
    secret = secrets.token_urlsafe(48)

updates = {
    "GOLFJOIN_MEMBER_AUTH_ENABLED": "Y",
    "GOLFJOIN_MEMBER_AUTH_GATE": "off",
    "GOLFJOIN_MEMBER_AUTH_SECRET": secret,
    "GOLFJOIN_MEMBER_AUTH_BUCKET": MEMBER_AUTH_BUCKET,
    "GOLFJOIN_MEMBER_AUTH_PREFIX": "member-auth/v1",
    "GOLFJOIN_MEMBER_OTP_TTL_SECONDS": "180",
    "GOLFJOIN_MEMBER_SIGNUP_OTP_TTL_SECONDS": "180",
    "GOLFJOIN_MEMBER_ACCESS_TTL_SECONDS": "300",
    "GOLFJOIN_MEMBER_SESSION_TTL_SECONDS": "86400",
    "GOLFJOIN_KAKAO_AUTH_ENABLED": "Y",
    "GOLFJOIN_KAKAO_ALLOWED_APP_IDS": "906676",
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

mode = stat.S_IMODE(ENV_FILE.stat().st_mode)
temp = ENV_FILE.with_name(ENV_FILE.name + ".stage15.tmp")
temp.write_text("\n".join(result) + "\n", encoding="utf-8")
os.chmod(temp, mode)
os.replace(temp, ENV_FILE)

print("회원 인증 환경변수 11개를 설정했습니다.")
print("일반회원 인증 세션을 24시간으로 설정했습니다.")
print("카카오 앱 906676의 서버 검증을 활성화했습니다.")
print("GOLFJOIN_MEMBER_AUTH_GATE=off 상태입니다.")
print("인증 비밀값은 출력하지 않았습니다.")
