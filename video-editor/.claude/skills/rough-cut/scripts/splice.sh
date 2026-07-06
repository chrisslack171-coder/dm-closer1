#!/usr/bin/env bash
# splice.sh — cuts + concatenates clips per cuts.json
# usage: splice.sh <job_dir>
# reads:  /tmp/video-editor/<job-name>/cuts.json
# writes: projects/<job-name>/outputs/<job-name>.mp4

set -euo pipefail

JOB_DIR="${1:?usage: splice.sh <job_dir>}"
JOB_DIR="$(cd "$JOB_DIR" && pwd)"
JOB_NAME="$(basename "$JOB_DIR")"
WORK="/tmp/video-editor/$JOB_NAME"
MEDIA_DIR="$JOB_DIR"
[ -d "$JOB_DIR/raw" ] && MEDIA_DIR="$JOB_DIR/raw"
OUT="$JOB_DIR/outputs"
CUTS="$WORK/cuts.json"
mkdir -p "$WORK" "$OUT"

[ -f "$CUTS" ] || { echo "missing $CUTS" >&2; exit 1; }

# cuts.json schema:
# { "segments": [ { "clip": "clip-01.mov", "start": 1.2, "end": 4.8 }, ... ] }

# SINGLE-PASS CLEAN SPLICE — cut + concat happen in ONE ffmpeg filtergraph, and the audio
# polish (static gain → hard limiter) is applied exactly ONCE to the assembled track, then
# encoded to AAC exactly ONCE. This is the "cut from raw, master once at the end" order:
#   • Audio rides through the cut LOSSLESS (PCM in the filtergraph) — NEVER encoded per-segment.
#     The old approach encoded each segment to AAC, copy-concatenated those AAC chunks (each join
#     splices in ~1024+ samples of AAC encoder priming = a tiny CLICK at every cut), then encoded
#     AAC a 2nd time. Two lossy generations + a click per boundary on pristine PCM source audio.
#     Processing per-segment before assembly is the bug; processing once after assembly is the fix.
#   • A/V stay LOCKED by construction: video and audio are trimmed from the SAME in/out points in
#     the same graph and concatenated together — no independent rebuild that could drift.
#   • trim/setpts rebases the first frame to pts 0 (no empty edit / QuickTime black-flash), verified.
#
# Audio chain — STATIC gain + hard limiter (your Premiere move). NOT loudnorm: single-pass
#   loudnorm runs DYNAMIC (rides gain over time) and PUMPS. This is static + transparent: constant
#   +AMPLIFY_DB gain, peaks brickwalled at −6 dBFS, zero time-varying leveling. Raw record level is
#   ~−30 dB mean, which is what the gain is calibrated against. `level=disabled` is REQUIRED —
#   alimiter's auto-level defaults ON and re-normalizes loud (clips to +TP / crushes LRA);
#   limit=0.501 = −6 dBFS. AMPLIFY_DB (default 10) is the only loudness knob — +10 over raw lands
#   ~−21 dB mean with peaks just kissing the limiter; +15 limited transients too hard (your call).
python3 - "$MEDIA_DIR" "$CUTS" "$OUT/${JOB_NAME}.mp4" <<'PY'
import json, os, sys, subprocess, platform
media_dir, cuts_path, out_path = sys.argv[1:]
amp = os.environ.get("AMPLIFY_DB", "10")
with open(cuts_path) as f:
    segs = json.load(f)["segments"]
if not segs:
    raise SystemExit("cuts.json has no segments")

# One -i per unique clip; segments reference the right input index.
inputs, idx = [], {}
def input_index(clip):
    p = clip if os.path.isabs(clip) else os.path.join(media_dir, clip)
    if not os.path.exists(p):
        raise SystemExit(f"clip not found: {p}")
    if p not in idx:
        idx[p] = len(inputs); inputs.append(p)
    return idx[p]

parts, labels = [], []
for i, seg in enumerate(segs):
    a, b = float(seg["start"]), float(seg["end"])
    if b <= a:
        raise SystemExit(f"segment {i} has end <= start: {seg}")
    k = input_index(seg["clip"])
    parts.append(f"[{k}:v]trim={a}:{b},setpts=PTS-STARTPTS[v{i}]")
    parts.append(f"[{k}:a]atrim={a}:{b},asetpts=PTS-STARTPTS,aresample=48000:ochl=stereo[a{i}]")
    labels.append(f"[v{i}][a{i}]")
n = len(segs)
parts.append("".join(labels) + f"concat=n={n}:v=1:a=1[vc][ac]")
parts.append(f"[ac]volume={amp}dB,"
             "alimiter=level_in=1:level_out=1:limit=0.501:attack=5:release=50:level=disabled[ao]")
fc = ";".join(parts)

# Video encoder, cross-platform: Apple's hardware encoder (videotoolbox) on macOS for speed;
# libx264 everywhere else (Windows/WSL/Linux) — always present in any ffmpeg build, no GPU needed.
# CRF 18 is visually ≈ the 8 Mbps videotoolbox target for a talking-head source.
if platform.system() == "Darwin":
    venc = ["-c:v", "h264_videotoolbox", "-b:v", "8M"]
else:
    venc = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p"]

cmd = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y"]
for p in inputs:
    cmd += ["-i", p]
cmd += ["-filter_complex", fc, "-map", "[vc]", "-map", "[ao]",
        *venc,
        "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
        "-video_track_timescale", "90000", "-movflags", "+faststart",
        out_path]
sys.exit(subprocess.run(cmd).returncode)
PY

echo "[splice] wrote $OUT/${JOB_NAME}.mp4" >&2
ffprobe -hide_banner -loglevel error -show_entries format=duration -of default=nw=1:nk=1 "$OUT/${JOB_NAME}.mp4"

# Persist the EDL durably alongside the canonical raw-timeline transcript.
# cuts.json otherwise lives only in /tmp (macOS clears it). The `to-premiere`
# off-ramp rebuilds the cut as separate timeline clips FROM this EDL, so it must
# survive past this session — same raw-timeline domain as transcript/words.json.
mkdir -p "$JOB_DIR/transcript"
cp "$CUTS" "$JOB_DIR/transcript/cuts.json" \
  && echo "[splice] persisted EDL → $JOB_DIR/transcript/cuts.json" >&2

# Derive the cut-aligned caption transcript from the SAME large-v3 words — no re-transcription.
# The locked caption presets + graphics-plan consume this instead of running their own whisper.
WORDS="$JOB_DIR/transcript/words.json"; [ -f "$WORDS" ] || WORDS="$WORK/words.json"
if [ -f "$WORDS" ]; then
  python3 "$(dirname "$0")/export-transcript.py" "$WORDS" "$CUTS" "$OUT/${JOB_NAME}.transcript.json" >&2 \
    && echo "[splice] derived caption transcript → $OUT/${JOB_NAME}.transcript.json" >&2
fi
