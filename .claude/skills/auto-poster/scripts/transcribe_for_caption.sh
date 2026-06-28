#!/usr/bin/env bash
# Transcribe a video for post captions using whisper.cpp.
#
# Defaults to the ggml-tiny.en model (~75 MB) — fast, fits comfortably on
# small sandbox disks, and accurate enough for short-form captions. Override
# with AUTO_POSTER_WHISPER_MODEL=base.en or small.en if you want more quality
# at the cost of disk + time.
#
# First run: clones + builds whisper.cpp and downloads the model
#   (~3–5 min, one-time, cached at ~/.cache/auto-poster/whisper.cpp).
# Later runs: reuses the cache, transcription takes a few seconds.
#
# Usage: transcribe_for_caption.sh <local-video-path-or-direct-url> [output.txt]
#
# If output.txt is omitted, the script writes to a freshly-created secure
# temp dir it owns and prints the path to stdout. Do NOT default to shared
# paths like /tmp/something.txt — anyone with write access to /tmp can
# pre-seed those files and inject content into your posts.

set -euo pipefail

VIDEO="${1:?usage: transcribe_for_caption.sh <local-video-path-or-direct-url> [output.txt]}"
OUT="${2:-}"

# Session-scoped work dir (mode 700, this user only).
WORK="$(mktemp -d "${TMPDIR:-/tmp}/auto-poster.XXXXXXXX")"
chmod 700 "$WORK"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

# Default output lives inside the work dir if caller didn't pass one.
# We copy it out to a sibling path so it survives cleanup.
KEEP_OUT=""
if [ -z "$OUT" ]; then
  KEEP_OUT="${TMPDIR:-/tmp}/auto-poster-transcript.$$.$(date +%s).txt"
  OUT="$WORK/transcript.txt"
fi

# Cache location for the whisper.cpp build + downloaded models.
WHISPER_DIR="${AUTO_POSTER_WHISPER_DIR:-$HOME/.cache/auto-poster/whisper.cpp}"
WHISPER_MODEL="${AUTO_POSTER_WHISPER_MODEL:-tiny.en}"
WHISPER_BIN="$WHISPER_DIR/build/bin/whisper-cli"
MODEL_FILE="$WHISPER_DIR/models/ggml-${WHISPER_MODEL}.bin"

log() { printf '[auto-poster] %s\n' "$*" >&2; }

# Resolve input: download if URL, otherwise must be a local file.
INPUT="$VIDEO"
case "$VIDEO" in
  http://*|https://*)
    INPUT="$WORK/source.mp4"
    curl -L --fail --silent --show-error "$VIDEO" -o "$INPUT"
    ;;
esac
if [ ! -f "$INPUT" ]; then
  log "video not found: $INPUT"
  exit 1
fi

# Extract 16 kHz mono PCM audio. This is ~50x smaller than the source video
# and is what whisper.cpp expects — feeding it raw video also works but
# wastes time on container demuxing.
AUDIO="$WORK/audio.wav"
ffmpeg -y -loglevel error -i "$INPUT" -vn -ac 1 -ar 16000 -c:a pcm_s16le "$AUDIO"

# Bootstrap whisper.cpp on first run.
if [ ! -x "$WHISPER_BIN" ]; then
  log "first-run bootstrap: building whisper.cpp at $WHISPER_DIR"
  mkdir -p "$(dirname "$WHISPER_DIR")"

  if [ ! -d "$WHISPER_DIR/.git" ]; then
    git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "$WHISPER_DIR"
  fi

  # whisper.cpp's Makefile shells out to cmake. Make sure it's on PATH.
  if ! command -v cmake >/dev/null 2>&1; then
    log "cmake not found, installing via pip"
    pip install --quiet cmake --break-system-packages 2>/dev/null \
      || pip install --quiet --user cmake
    # pip --user puts scripts here on Linux; harmless on macOS.
    export PATH="$HOME/.local/bin:$PATH"
  fi

  (cd "$WHISPER_DIR" && make -j4 >/dev/null)
fi

# Download model if missing.
if [ ! -f "$MODEL_FILE" ]; then
  log "downloading ggml-${WHISPER_MODEL} model"
  (cd "$WHISPER_DIR" && bash ./models/download-ggml-model.sh "$WHISPER_MODEL" >/dev/null)
fi

# Transcribe. -nt strips timestamps, -np skips the noisy progress bar.
mkdir -p "$(dirname "$OUT")"
"$WHISPER_BIN" -m "$MODEL_FILE" -f "$AUDIO" -nt -np 2>/dev/null > "$OUT"

# Trim whitespace.
python3 - "$OUT" <<'PY'
import sys, pathlib
p = pathlib.Path(sys.argv[1])
p.write_text(p.read_text().strip() + "\n")
PY

# Move output out of the work dir so trap cleanup doesn't delete it.
if [ -n "$KEEP_OUT" ]; then
  cp "$OUT" "$KEEP_OUT"
  chmod 600 "$KEEP_OUT"
  echo "$KEEP_OUT"
else
  echo "$OUT"
fi
