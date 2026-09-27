#!/usr/bin/env python3
"""Import the existing local automation .env into V2 GitHub Actions secrets.

Run on the computer holding the real .env, after `gh auth login`. Values are
passed over stdin to gh, never echoed, written to this repo, or put in argv.
"""

import argparse
from pathlib import Path
import re
import subprocess
import sys


REPO = "XyLyX/navvyasignal-v2"
REQUIRED = (
    "ANTHROPIC_API_KEY", "NOTION_API_KEY", "NOTION_DATABASE_ID",
    "GEMINI_API_KEY", "KIT_API_KEY", "WHAPI_TOKEN", "WHAPI_CHANNEL_ID",
)
OPTIONAL = ("KIT_FROM_EMAIL", "OPS_NOTIFY_NUMBER", "V2_NETLIFY_BUILD_HOOK")
ASSIGNMENT = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(.*)$")
BUILD_HOOK = re.compile(r"^https://api\.netlify\.com/build_hooks/[A-Za-z0-9]+$")


def read_env(path: Path) -> dict[str, str]:
    values = {}
    for number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        match = ASSIGNMENT.fullmatch(line)
        if not match:
            raise ValueError(f"Unsupported .env syntax at line {number}; no secrets were uploaded.")
        name, value = match.groups()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        values[name] = value
    return values


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("env_file", type=Path, help="path to the existing local .env")
    args = parser.parse_args()
    try:
        values = read_env(args.env_file)
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"Cannot read .env: {exc}", file=sys.stderr)
        return 1

    missing = [key for key in REQUIRED if not values.get(key)]
    if missing:
        print("Missing required keys: " + ", ".join(missing), file=sys.stderr)
        return 1
    hook = values.get("V2_NETLIFY_BUILD_HOOK")
    if hook and not BUILD_HOOK.fullmatch(hook):
        print("V2_NETLIFY_BUILD_HOOK has an unexpected URL; no secrets were uploaded.", file=sys.stderr)
        return 1

    try:
        subprocess.run(["gh", "auth", "status", "-h", "github.com"],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("Install GitHub CLI and run `gh auth login` before importing.", file=sys.stderr)
        return 1

    selected = [key for key in REQUIRED + OPTIONAL if values.get(key)]
    print(f"Uploading {len(selected)} named secrets to {REPO}; values will not be displayed.")
    for key in selected:
        try:
            subprocess.run(["gh", "secret", "set", key, "--repo", REPO],
                           input=values[key].encode("utf-8"), check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError:
            print(f"Upload failed for {key}. Check repository access; earlier keys may be set.", file=sys.stderr)
            return 1
        print(f"Set {key}")
    for key in OPTIONAL:
        if not values.get(key):
            print(f"Optional key absent: {key}")
    print("Keep V2_PIPELINE_ENABLED and V2_LEGACY_SENDER_DISABLED unset until cutover.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
