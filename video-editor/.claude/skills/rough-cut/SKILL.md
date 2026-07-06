---
name: rough-cut
description: "Rough-cuts short-form reels from raw clips. Transcribes with WhisperX (large-v3 + wav2vec2 word-level alignment), kills filler + dead air, keeps only the essential lines, stitches with FFmpeg. No captions, no B-roll — just a tight rough cut ready for final polish. Triggers: edit this reel, rough cut, cut this video, edit the latest project, trim this, chop this up, rough-cut, make a rough cut."
---

# Rough Cut — Transcript-Driven Edits

Turns raw talking-head clips into a tight rough cut. You transcribe, you decide the cuts, FFmpeg stitches. The goal: **shortest possible reel that still delivers the value.** Respect the viewer's time.

## How to Trigger
- **"edit the latest project"** → finds the newest job folder, edits it
- **"rough cut [job name]"** → edits a specific job folder
- **"cut this reel"** with a path → edits that folder

---

## Folder Contract

The skill operates out of `/video-editor/` at the repo root.

```
video-editor/
├── projects/
│   └── <job-name>/              ← one folder per reel
│       ├── raw/                 ← raw clips (any name, any count)
│       │   ├── clip-01.mov
│       │   └── clip-02.mov
│       ├── audio/               ← OPTIONAL — music beds / audio assets
│       ├── assets/              ← OPTIONAL — refs, screen recordings, B-roll sources
│       ├── thumbnails/          ← OPTIONAL — thumbnail source images/working files
│       ├── outputs/             ← rendered deliverables for this job
│       │   └── <job-name>.mp4
│       └── intent.md            ← OPTIONAL — what the reel is about
```

**Naming a new job:** name the folder after the **video's content** — a short, made-up kebab-case title that describes what the reel is about (e.g. `your-job`, `cold-dm-teardown`). NEVER name it after the camera/source file (`C1840.MP4` → ~~`c1840-roughcut`~~) or a date. If the content isn't obvious yet, skim the transcript first, then name it. No stage suffixes (`-roughcut`, `-final`) — one folder is the whole content piece across all stages.

The canonical transcript (`words.json`) and cut sheet (`cuts.json`) persist durably to `projects/<job-name>/transcript/` — read those when iterating. Encoded segments and other scratch live in `/tmp/video-editor/<job-name>/`, which macOS clears, so never depend on anything living solely in `/tmp`.

If no `intent.md` exists, ask in one line: *"Give me the hook + takeaway in a sentence so I know what to keep."*

---

## The Edit Philosophy (non-negotiable)

**Short and snappy, max value per second, respect the viewer.**

Every cut decision runs through this filter:
1. **Does this line deliver value?** If not, kill it.
2. **Is this the tightest version?** If there's a shorter take, use it.
3. **Would a viewer skip past this?** If yes, it's dead.

**Target length depends on format** (decide format first — see `workflows/` at the repo root):
- **Short-form** (9:16 Reels/TikTok/Shorts) → aim **1–2 minutes.** The "shortest version that still delivers" filter still governs — 1–2 min is the target *after* ruthless cutting, not permission to ramble. If the value fits in 40s, ship 40s.
- **Long-form** (16:9 YouTube) → **no length cap.** Cut for retention and structure, not to hit a number. Kill dead air and filler, keep the substance.

---

## Auto-Kill Rules (always apply)

When building `cuts.json`, automatically remove:

| Kill | Why |
|------|-----|
| Filler words: *um, uh, like, you know, so yeah, basically* (when vestigial) | Dead weight |
| Stutters + false starts: *"I- I was gonna-"* | Breaks flow |
| Restarted takes | Keep the **last** take, kill the rest — you always wants the latest take of a repeated line (warmest delivery). Don't compare takes; default to the last one. |
| Silences > 0.4s | Dead air |
| Tangents + asides that don't serve the hook/takeaway | Respect viewer time |
| Throat-clears, "okay let me start over", etc. | Production noise |
| Preamble before the hook lands | Every reel opens ON the hook |

**Preserve the creator's cadence though.** Don't surgical-kill every "like" — some are rhythm, some are filler. Taste call.

---

## The Pipeline

### Step 1 — Transcribe

Find the job folder. Run:

```bash
bash .claude/skills/rough-cut/scripts/transcribe.sh <job_dir>
```

This runs WhisperX (large-v3 ASR + wav2vec2 forced alignment) with true word-level timestamps and writes `/tmp/video-editor/<job-name>/words.json`. Word timestamps are tighter than plain faster-whisper, so cuts land more precisely.

**This is the ONE transcription for the entire pipeline — rough cut AND finishing captions.** The transcript is persisted canonically to `projects/<job>/transcript/words.json` and **reused forever**: re-running `transcribe.sh` skips WhisperX and reuses the canonical copy (pass `--force` to re-transcribe). Nothing downstream transcribes this footage again — the locked caption presets (`presets/captions/build.py`, `presets/tiktok-raw/build.py`) and `graphics-plan` consume the derived `outputs/<job>.transcript.json` instead (see Step 3 + Handoff). WhisperX large-v3 is the most accurate engine we have, so it's the single source of truth.

**Add `--diarize`** to label each word with a speaker (multi-person clips). Requires `HUGGINGFACE_TOKEN` in env and accepting the pyannote/speaker-diarization-3.1 model on HF.

**Run in background** if expected >2min:
- ~30s of clip = ~10-20s wall time (first run is slower — alignment model downloads)
- ~5min of clip = ~2min wall time

For total clip length >3min, use `run_in_background: true` and Monitor.

### Step 2 — Read the transcript + decide cuts

Read `/tmp/video-editor/<job-name>/words.json`. Each clip has a `words` array of `{w, start, end, prob}` (plus `speaker` when `--diarize` was used).

Apply the auto-kill rules and the edit philosophy. Output `/tmp/video-editor/<job-name>/cuts.json` in this shape:

```json
{
  "segments": [
    { "clip": "clip-02.mov", "start": 1.24, "end": 4.60, "transcript": "Are you still paying a VA three grand a month" },
    { "clip": "clip-02.mov", "start": 4.95, "end": 8.10, "transcript": "to do shit Claude Code can do for free in five minutes" },
    { "clip": "clip-01.mov", "start": 12.20, "end": 18.80, "transcript": "..." }
  ]
}
```

**Timestamp rules:**
- Trust WhisperX word-level timestamps as the source of truth.
- Start on the first word you want, usually `word.start - 0.03` to `0.08`.
- End after the last word you want, usually `word.end + 0.04` to `0.10`.
- Don't cut mid-word. If a transition feels clipped, adjust `cuts.json` manually and rerender.
- Segments CAN cross clips in any order — that's the whole point.

Include the `transcript` field for each segment so the creator can read the cut sheet and sanity-check it without watching.

### Step 3 — Splice

```bash
bash .claude/skills/rough-cut/scripts/splice.sh <job_dir>
```

Writes `projects/<job-name>/outputs/<job-name>.mp4` directly from `/tmp/video-editor/<job-name>/cuts.json` in a **single FFmpeg filtergraph** — one `trim`/`atrim` per kept segment → `concat` → static gain → limiter, encoded once. Audio rides through the cut **lossless (PCM in-graph)** and is polished **once** on the assembled track (+10 dB amplify → −6 dBFS hard limiter, AAC encoded once at 256k); it is **never** encoded per-segment (that caused boundary click-pops). Video and audio are trimmed from the same in/out and concatenated together, so A/V stay locked by construction.

It also writes **`outputs/<job-name>.transcript.json`** — the cut-aligned caption transcript, derived by remapping the kept words through `cuts.json` (via `export-transcript.py`). Same large-v3 quality, timestamps rebased to the edited timeline, **zero re-transcription.** This is what finishing/captions/graphics all consume.

**Spelling/brand fixes happen HERE, once.** `export-transcript.py` applies [`presets/caption-corrections.json`](../../../presets/caption-corrections.json) to the canonical transcript as it writes it — `auto` entries (non-word mishears + brand/name casing, e.g. a mis-heard product or person's name) are replaced silently; `flag` entries (real words that might be mishears, e.g. `cloud` for a mis-heard product name) are printed to eyeball. Because this is the one source of truth every downstream step reads, the fix propagates to graphics-plan, both caption formats, and long-form — not just burned-in captions. The raw `transcript/words.json` is left untouched. Per-video one-offs go in `projects/<job>/corrections.local.json` (same `{auto,flag}` shape, merged on top). Watch the splice log for `auto-fixed:` and `⚠ REVIEW` lines; add new mishears to the dictionary so they're fixed everywhere forever.

**Always run in background** — renders take 15-45s for 60s output.

### Step 3.5 — Dynamic transcription QA (auto, every run)

The static dictionary only fixes mishears it already knows. This step catches the **new** ones — names/brands WhisperX mangled that aren't in the dictionary yet — and auto-applies the safe fixes. **Run it every job, right after splice:**

```bash
python3 .claude/skills/rough-cut/scripts/scan-transcript.py <job_dir>
```

It compares every transcript word against a 235k-word English wordlist (+ inflection stripping) and the dictionary, and prints only the **suspects** — words that are neither ordinary English nor already-handled terms. On a clean transcript this is empty; otherwise you get a short list with context, e.g. `higsfield  ×1  …built it on higsfield and pushed to…`.

**Judge each suspect in context, then act:**
- **Real mistranscription, single token, recurring name/brand** (e.g. `higsfield → Higgsfield`) → add to [`presets/caption-corrections.json`](../../../presets/caption-corrections.json) `auto` so it's fixed everywhere forever.
- **Real mistranscription, one-off for this video** → add to `projects/<job>/corrections.local.json`.
- **Multi-token mishear** (e.g. "higs field" → "Higgsfield", two words → one) → do **not** auto-apply (it would change word count and break per-word timestamps). Flag it in the report for you instead.
- **Already-correct proper noun** (a real name, your term like LARP) → skip.

Then re-apply (instant, timings + cuts untouched):

```bash
bash .claude/skills/rough-cut/scripts/reapply-corrections.sh <job_dir>
```

**Hard rule:** only ever auto-apply **single-token, whole-word** swaps — the dictionary mechanism enforces this, which is exactly why it can never shift a timestamp or alter a cut. When unsure whether a word is a mishear or correct, flag it; don't guess.

### Step 4 — Report back

Show the creator:
- Final duration vs raw total (e.g., "3:47 → 0:48, 79% cut")
- The cut sheet (clip + timestamp + line) to review
- Path to the MP4

---

## Output Format

After the cut lands, report like this:

```
✂️ ROUGH CUT DONE

📊 3:47 → 0:48 (79% cut)
📁 projects/<job-name>/outputs/<job-name>.mp4

CUT SHEET:
1. [clip-02 @ 1.24-4.60] "Are you still paying a VA three grand a month"
2. [clip-02 @ 4.95-8.10] "to do shit Claude Code can do for free"
...
```

Keep it tight. If a segment feels weak, flag it: **"⚠️ segment 3 is borderline — consider killing."**

---

## Gotchas

- **`-c copy` alone doesn't work on arbitrary cut points** — causes A/V desync. `splice.sh` re-encodes each segment with hardware accel, which is still fast (~15s for a 60s reel). Don't "optimize" to pure stream copy.
- **Don't auto-snap cuts to silence.** WhisperX word alignment is the unlock. Automatic silencedetect snapping can move intentionally chosen boundaries into filler words or awkward pauses.
- **Whisper can mishear.** Always cross-check the transcript before killing a line — sometimes "Claude" becomes "cloud" or "Cloud" and the line looks wrong when it's fine.
- **Transcribe.sh auto-skips** when `projects/<job-name>/transcript/words.json` exists — it's the canonical transcript, reused forever. Use `--force` only if the raw footage actually changed. Transcribing is the slowest step; this guarantees it runs once per video.
- **Clip order in `cuts.json` = final order in the reel.** You're writing the script sequence.
- **If intent.md is missing and no direction was given**, ask one question in one sentence. Don't guess.

---

## Handoff

Once the rough cut is approved, continue the pipeline (the repo-root `CLAUDE.md` has the full seven-step flow): **graphics** (`graphics-plan` → HyperFrames) → **captions** (short-form only) → optional **background music** → **export** (`finalize.sh`). **Finishing differs by format** — read the matching file in `workflows/` at the repo root:
- **Short-form** (`workflows/short-form.md`): 9:16 reframe + top-half graphics inside the platform safe zones, then **burn-in captions from the locked presets** — explainer → [`presets/captions-style.md`](../../../presets/captions-style.md), TikTok/raw → [`presets/tiktok-raw-style.md`](../../../presets/tiktok-raw-style.md).
- **Long-form** (`workflows/long-form.md`): stays 16:9, full graphics/hook treatment, **no captions** (YouTube CC only).

Reframe, graphics, and inserts run through the vendored HyperFrames toolkit (`general-video`/`hyperframes`). Captions are built by the **locked PIL preset builders** (`presets/captions/build.py`, `presets/tiktok-raw/build.py`), not by re-transcribing — they read the canonical `outputs/<job>.transcript.json` this skill already produced (transcribe-once: same large-v3 words, timestamps rebased to the cut timeline). After export, posting/distribution happens **outside this repo**.

This skill does ONE thing: cut the reel down to the essential lines (audio is normalized as part of the cut). It does not do captions, B-roll, zoom effects, or vertical reframing.
