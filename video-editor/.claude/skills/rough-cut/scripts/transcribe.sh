#!/usr/bin/env bash
# transcribe.sh — runs WhisperX (large-v3 + wav2vec2 forced alignment) on every clip in a job folder
# usage: transcribe.sh <job_dir> [--diarize]
# output: <job_dir>/transcript/words.json  (durable canonical — transcribe ONCE, reuse forever;
#         /tmp/video-editor/<job-name>/ is just render scratch)
#
# --diarize adds speaker labels per word (requires HUGGINGFACE_TOKEN in env;
# pyannote/speaker-diarization-3.1 must be accepted on Hugging Face).

set -euo pipefail

JOB_DIR="${1:?usage: transcribe.sh <job_dir> [--diarize]}"
JOB_DIR="$(cd "$JOB_DIR" && pwd)"
JOB_NAME="$(basename "$JOB_DIR")"
MEDIA_DIR="$JOB_DIR"
[ -d "$JOB_DIR/raw" ] && MEDIA_DIR="$JOB_DIR/raw"
WORK="/tmp/video-editor/$JOB_NAME"
CANON="$JOB_DIR/transcript/words.json"   # persisted canonical transcript — transcribe ONCE, reuse forever
mkdir -p "$WORK" "$JOB_DIR/transcript"

DIARIZE=0
FORCE=0
shift
while [ $# -gt 0 ]; do
  case "$1" in
    --diarize) DIARIZE=1 ;;
    --force)   FORCE=1 ;;
    *) echo "unknown flag: $1" >&2; exit 1 ;;
  esac
  shift
done

# Transcribe ONCE. WhisperX large-v3 is slow + deterministic, so a persisted canonical
# transcript wins unless --force. This is the single source of truth for the whole
# pipeline (rough cut AND finishing captions) — nothing else transcribes this footage.
if [ "$FORCE" -eq 0 ] && [ -f "$CANON" ]; then
  echo "[transcribe] reusing canonical transcript $CANON (pass --force to re-transcribe)" >&2
  cp "$CANON" "$WORK/words.json"
  echo "$WORK/words.json"
  exit 0
fi

shopt -s nullglob nocaseglob
CLIPS=("$MEDIA_DIR"/*.mov "$MEDIA_DIR"/*.mp4 "$MEDIA_DIR"/*.mkv "$MEDIA_DIR"/*.m4v)
shopt -u nocaseglob
if [ ${#CLIPS[@]} -eq 0 ]; then
  echo "no clips found in $MEDIA_DIR" >&2
  exit 1
fi

if [ -d /opt/homebrew/opt/ffmpeg@7 ]; then
  export DYLD_LIBRARY_PATH="/opt/homebrew/opt/ffmpeg@7/lib:${DYLD_LIBRARY_PATH:-}"
  export PATH="/opt/homebrew/opt/ffmpeg@7/bin:$PATH"
fi

# Persistent venv: built once, reused every run. whisperx pulls torch, so it
# gets its own box — it can't share the faster-whisper venv (different deps).
VENV="${VIDEO_EDITOR_WHISPERX_VENV:-$HOME/.cache/video-editor/whisperx-venv}"
PYBIN="$VENV/bin/python"
# sentinel written only after a successful install — a half-built venv (install
# interrupted once) self-heals on the next run instead of wedging forever
if [ ! -e "$VENV/.deps-ok" ]; then
  echo "[transcribe] first-run: building whisperx venv at $VENV (pulls torch, ~minutes)" >&2
  rm -rf "$VENV"
  uv venv "$VENV" --python 3.11 >&2
  uv pip install --python "$PYBIN" whisperx >&2
  touch "$VENV/.deps-ok"
fi

"$PYBIN" - "$WORK/words.json" "$DIARIZE" "${CLIPS[@]}" <<'PY'
import json, os, sys
import whisperx

out_path = sys.argv[1]
diarize_flag = sys.argv[2] == "1"
clip_paths = sys.argv[3:]

# CPU + int8 is the reliable path on M-series. MPS support in whisperx/torch is
# still spotty for some ops; CPU is slower but never silently wrong.
device = "cpu"
compute_type = "int8"
batch_size = 8

print(f"[transcribe] loading whisperx large-v3 ({device}, {compute_type})", file=sys.stderr)
asr_model = whisperx.load_model("large-v3", device, compute_type=compute_type, language="en")

print("[transcribe] loading wav2vec2 alignment model", file=sys.stderr)
align_model, align_metadata = whisperx.load_align_model(language_code="en", device=device)

diarize_model = None
if diarize_flag:
    hf_token = os.environ.get("HUGGINGFACE_TOKEN", "").strip()
    if not hf_token:
        print("[transcribe] --diarize requires HUGGINGFACE_TOKEN in env", file=sys.stderr)
        sys.exit(1)
    print("[transcribe] loading pyannote diarization pipeline", file=sys.stderr)
    diarize_model = whisperx.DiarizationPipeline(use_auth_token=hf_token, device=device)

result = {"clips": []}
for path in clip_paths:
    name = os.path.basename(path)
    print(f"[transcribe] {name}", file=sys.stderr)
    audio = whisperx.load_audio(path)
    duration = len(audio) / 16000.0

    transcribe_result = asr_model.transcribe(audio, batch_size=batch_size, language="en")
    aligned = whisperx.align(
        transcribe_result["segments"],
        align_model,
        align_metadata,
        audio,
        device,
        return_char_alignments=False,
    )

    if diarize_model is not None:
        diarize_segments = diarize_model(audio)
        aligned = whisperx.assign_word_speakers(diarize_segments, aligned)

    words = []
    for seg in aligned.get("segments", []):
        for w in seg.get("words", []):
            # wav2vec2 sometimes can't align unspeakable tokens (numerals, punctuation).
            # Skip words missing timestamps so cuts.json builders don't crash.
            if "start" not in w or "end" not in w:
                continue
            entry = {
                "w": str(w.get("word", "")).strip(),
                "start": round(float(w["start"]), 3),
                "end": round(float(w["end"]), 3),
                "prob": round(float(w.get("score", 1.0)), 3),
            }
            if "speaker" in w:
                entry["speaker"] = w["speaker"]
            words.append(entry)

    result["clips"].append({
        "clip": name,
        "path": path,
        "duration": round(duration, 3),
        "words": words,
    })

with open(out_path, "w") as f:
    json.dump(result, f, indent=2)
print(f"[transcribe] wrote {out_path}", file=sys.stderr)
PY

# Persist the canonical copy so we never transcribe this footage again.
cp "$WORK/words.json" "$CANON"
echo "[transcribe] persisted canonical transcript → $CANON" >&2
echo "$WORK/words.json"
