#!/usr/bin/env bash
# reel-breakdown.sh — download a reel, grab keyframes, transcribe it.
# usage: reel-breakdown.sh <outdir> <video_url>
#
#   <video_url>  the detailedData `videoUrl` (a muxed mp4 CDN link with
#                audio+video) — downloaded with a plain curl. CDN URLs are
#                signed + expire, so the subagent downloads immediately.
#
# Produces in <outdir>:
#   video.mp4        the downloaded reel
#   frame_01s.jpg …  keyframes at 1s, 2s, 3s, and the video midpoint
#   transcript.md    hook (first spoken line) + full transcript
#
# Whisper model defaults to small.en (override: WHISPER_MODEL=medium.en).
# Reuses the shared faster-whisper venv from the transcribe-url skill.
set -euo pipefail

OUTDIR="${1:?usage: reel-breakdown.sh <outdir> <video_url>}"
SRC="${2:?usage: reel-breakdown.sh <outdir> <video_url> (the detailedData videoUrl)}"
MODEL="${WHISPER_MODEL:-small.en}"
mkdir -p "$OUTDIR"
VIDEO="$OUTDIR/video.mp4"

# --- download: curl the muxed CDN videoUrl (retry transient blips) ---
echo "[reel] curl $SRC" >&2
curl -fsSL --retry 3 --retry-delay 1 -H 'User-Agent: Mozilla/5.0' "$SRC" -o "$VIDEO" 2>/dev/null || true
[ -s "$VIDEO" ] || { echo "[error] reel download failed (videoUrl dead/expired): $SRC" >&2; exit 1; }

# --- keyframes: 1s, 2s, 3s (hook window) + midpoint (body format) ---
DUR="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VIDEO" 2>/dev/null | cut -d. -f1)"
[ -z "$DUR" ] && DUR=0
MID=$(( DUR / 2 )); [ "$MID" -lt 1 ] && MID=4
for t in 1 2 3 "$MID"; do
  label="$(printf '%02ds' "$t")"
  ffmpeg -nostdin -loglevel error -ss "$t" -i "$VIDEO" -frames:v 1 -q:v 3 \
    "$OUTDIR/frame_${label}.jpg" -y >&2 || true
done

# --- audio → whisper ---
AUDIO="$OUTDIR/audio.mp3"
ffmpeg -nostdin -loglevel error -i "$VIDEO" -vn -ac 1 -ar 16000 -q:a 4 "$AUDIO" -y >&2

export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-$HOME/.cache/transcribe-url-venv}"
echo "[reel] transcribing (model=$MODEL)" >&2
uv run --quiet --python 3.11 --with "faster-whisper" --with "onnxruntime" \
  python - "$AUDIO" "$OUTDIR/transcript.md" "$MODEL" <<'PY'
import sys
from faster_whisper import WhisperModel

audio, out_file, model_name = sys.argv[1:]
model = WhisperModel(model_name, device="auto", compute_type="int8")
segments, _ = model.transcribe(
    audio, vad_filter=True, vad_parameters=dict(min_silence_duration_ms=500)
)
segs = [s.text.strip() for s in segments if s.text.strip()]
hook = segs[0] if segs else "(no speech detected)"
full = " ".join(segs) if segs else "(no speech detected)"
with open(out_file, "w") as f:
    f.write(f"**Hook (first spoken line):** {hook}\n\n**Full transcript:**\n\n{full}\n")
PY

echo "$OUTDIR"
