#!/usr/bin/env python3
"""Safely change only the GolfJoin member-auth gate in the Cloud Shell env file."""

import argparse
import json
import os
import re
import stat
from pathlib import Path


ALLOWED_GATES = ("off", "report", "enforce")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("gate", choices=ALLOWED_GATES)
    parser.add_argument(
        "--env-file",
        default="/home/llno95ll/golfjoin-sheet-api.env.yaml",
    )
    return parser.parse_args()


def read_yaml_scalar(source, name):
    match = re.search(rf"^{re.escape(name)}:\s*(.*)$", source, re.MULTILINE)
    if not match:
        return ""
    value = match.group(1).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    return value.strip()


def replace_yaml_scalar(source, name, value):
    replacement = f"{name}: {json.dumps(value)}"
    pattern = re.compile(rf"^{re.escape(name)}:\s*.*$", re.MULTILINE)
    if pattern.search(source):
        return pattern.sub(replacement, source, count=1)
    suffix = "" if not source or source.endswith("\n") else "\n"
    return f"{source}{suffix}{replacement}\n"


def main():
    args = parse_args()
    path = Path(args.env_file).expanduser().resolve()
    if not path.is_file():
        raise SystemExit(f"환경변수 파일을 찾지 못했습니다: {path}")

    source = path.read_text(encoding="utf-8")
    enabled = read_yaml_scalar(source, "GOLFJOIN_MEMBER_AUTH_ENABLED").upper()
    secret = read_yaml_scalar(source, "GOLFJOIN_MEMBER_AUTH_SECRET")
    bucket = read_yaml_scalar(source, "GOLFJOIN_MEMBER_AUTH_BUCKET")
    current_gate = read_yaml_scalar(source, "GOLFJOIN_MEMBER_AUTH_GATE") or "off"

    if enabled != "Y":
        raise SystemExit("GOLFJOIN_MEMBER_AUTH_ENABLED가 Y가 아니므로 Gate를 변경하지 않았습니다.")
    if len(secret.encode("utf-8")) < 32:
        raise SystemExit("GOLFJOIN_MEMBER_AUTH_SECRET이 32바이트 미만이므로 Gate를 변경하지 않았습니다.")
    if not bucket:
        raise SystemExit("GOLFJOIN_MEMBER_AUTH_BUCKET이 없으므로 Gate를 변경하지 않았습니다.")

    updated = replace_yaml_scalar(source, "GOLFJOIN_MEMBER_AUTH_GATE", args.gate)
    mode = stat.S_IMODE(path.stat().st_mode)
    temporary = path.with_name(f"{path.name}.stage30.tmp")
    temporary.write_text(updated, encoding="utf-8")
    os.chmod(temporary, mode)
    os.replace(temporary, path)

    print(f"GOLFJOIN_MEMBER_AUTH_GATE: {current_gate} -> {args.gate}")
    print("인증 비밀값과 회원정보는 출력하지 않았습니다.")


if __name__ == "__main__":
    main()
