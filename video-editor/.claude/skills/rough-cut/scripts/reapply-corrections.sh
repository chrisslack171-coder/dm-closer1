#!/usr/bin/env bash
# reapply-corrections.sh — re-derive the canonical transcript from the persisted
# raw words + EDL, re-applying the CURRENT caption-corrections.json (+ any per-job
# corrections.local.json). Use after adding a newly-discovered mishear to the dict
# during the dynamic-QA step. Pure text re-map — timings + cuts are untouched.
#
# usage: reapply-corrections.sh <job_dir>
set -euo pipefail
JOB_DIR="${1:?usage: reapply-corrections.sh <job_dir>}"
JOB_NAME="$(basename "$JOB_DIR")"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORDS="$JOB_DIR/transcript/words.json"
CUTS="$JOB_DIR/transcript/cuts.json"
TMP_CUTS="/tmp/video-editor/$JOB_NAME/cuts.json"
OUT="$JOB_DIR/outputs/$JOB_NAME.transcript.json"

[ -f "$WORDS" ] || { echo "missing $WORDS — run rough-cut first" >&2; exit 1; }
# cuts.json persists under transcript/ now; a job cut before that change may only have the
# /tmp copy — rescue it into transcript/ if it's still there.
if [ ! -f "$CUTS" ] && [ -f "$TMP_CUTS" ]; then
  mkdir -p "$JOB_DIR/transcript"
  cp "$TMP_CUTS" "$CUTS"
  echo "recovered cuts.json from $TMP_CUTS → $CUTS" >&2
fi
[ -f "$CUTS" ] || { echo "missing $CUTS (no /tmp copy either) — re-run splice.sh on this job to regenerate + persist the EDL, then retry" >&2; exit 1; }

python3 "$HERE/export-transcript.py" "$WORDS" "$CUTS" "$OUT"
