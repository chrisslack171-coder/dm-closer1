#!/usr/bin/env bash
# fetch-images.sh — download carousel slides / a single image for visual analysis.
# usage: fetch-images.sh <outdir> <image_url> [image_url ...]
#
# Pass the Apify `images[]` array (carousel) or the single `displayUrl` (image
# post). Slides are saved in order as slide_01.jpg, slide_02.jpg, …
# These are public cdninstagram/fbcdn URLs — a plain curl is enough.
set -euo pipefail

OUTDIR="${1:?usage: fetch-images.sh <outdir> <image_url> [image_url ...]}"
shift
[ "$#" -ge 1 ] || { echo "[error] no image urls passed" >&2; exit 1; }
mkdir -p "$OUTDIR"

i=0
for url in "$@"; do
  i=$((i + 1))
  out="$OUTDIR/$(printf 'slide_%02d.jpg' "$i")"
  curl -fsSL --retry 3 --retry-delay 1 \
    -H 'User-Agent: Mozilla/5.0' \
    "$url" -o "$out" >&2 || { echo "[warn] slide $i failed" >&2; continue; }
done

[ "$(find "$OUTDIR" -name 'slide_*.jpg' | wc -l | tr -d ' ')" -gt 0 ] \
  || { echo "[error] no slides downloaded" >&2; exit 1; }
echo "$OUTDIR"
