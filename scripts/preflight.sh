#!/usr/bin/env bash
# preflight.sh — verify the report-builder toolchain is installed and working.
# Safe to run anywhere. On macOS this is the real target; run it before a build.
#
#   bash scripts/preflight.sh
#
# Exit code 0 = every required tool is present and the live checks passed.
# Exit code 1 = at least one required tool is missing or a live check failed.

set -u

pass=0; fail=0; warn=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; fail=$((fail+1)); }
note() { printf '  \033[33m!\033[0m %s\n' "$1"; warn=$((warn+1)); }

echo "report-builder preflight"
echo "------------------------"

# --- required binaries ---------------------------------------------------
echo "tools:"
for t in uv yt-dlp python3 curl bash; do
  if command -v "$t" >/dev/null 2>&1; then
    ver=$("$t" --version 2>&1 | head -1)
    ok "$t — $ver"
  else
    bad "$t — NOT FOUND (install: 'brew install $t' on macOS)"
  fi
done

# 'open' is macOS-only; only required there. Optional elsewhere.
if command -v open >/dev/null 2>&1; then
  ok "open — present (auto-opens the report)"
elif [ "$(uname)" = "Darwin" ]; then
  bad "open — NOT FOUND but expected on macOS"
else
  note "open — absent (macOS-only; report won't auto-open on $(uname))"
fi

# --- live network checks -------------------------------------------------
# The whole pipeline is useless if YouTube/thumbnails are unreachable, so
# probe them for real rather than trusting that the binaries exist.
echo "network:"
if command -v yt-dlp >/dev/null 2>&1; then
  if yt-dlp --skip-download --quiet --no-warnings \
       --print "%(channel)s" "https://www.youtube.com/watch?v=dQw4w9WgXcQ" \
       >/dev/null 2>&1; then
    ok "yt-dlp can reach YouTube and read metadata"
  else
    bad "yt-dlp cannot reach YouTube (network/proxy blocked, or YouTube changed)"
  fi
fi
if command -v curl >/dev/null 2>&1; then
  code=$(curl -sS -o /dev/null -w '%{http_code}' \
         "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" 2>/dev/null)
  if [ "$code" = "200" ]; then
    ok "curl can download thumbnails (HTTP $code)"
  else
    bad "curl cannot reach i.ytimg.com (got '$code')"
  fi
fi

# --- python stdlib the ranking script relies on --------------------------
echo "python:"
if command -v python3 >/dev/null 2>&1; then
  if python3 -c "import json,urllib.request,subprocess,csv,html,datetime" 2>/dev/null; then
    ok "python3 stdlib modules available (ranking script)"
  else
    bad "python3 is missing a stdlib module the ranking script needs"
  fi
fi

echo "------------------------"
printf 'result: %d ok, %d warn, %d failed\n' "$pass" "$warn" "$fail"
[ "$fail" -eq 0 ] && exit 0 || exit 1
