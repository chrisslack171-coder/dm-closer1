# ig-competitor-research — setup

Scans Instagram **and** TikTok competitors, ranks their last-week short-form videos by likes + breakout score (with real view counts), transcribes/analyzes each winner locally, and builds a self-contained HTML report. Claude drives the whole thing — you just trigger it ("research @handle_a @handle_b", "tiktok research @handle", or "content research" to use your competitor list).

## Install

Drop this folder into a skills directory:
- `<project>/.claude/skills/ig-competitor-research/` — for one project, or
- `~/.claude/skills/ig-competitor-research/` — to use it everywhere.

## Prerequisites

**1. tokscript MCP (required, Pro/Premium).** Scraping is one listing call per handle — `get_instagram_user_reels` for Instagram, `get_tiktok_user_videos` for TikTok — plus one `download_video` per winner. Connect the **tokscript MCP server** in Claude Code on a **Pro/Premium** plan (the free tier only allows 5 single-URL extractions/day and can't list a profile's videos). No API token or env vars — the OAuth MCP connection handles auth.

**2. System tools.** Install these (the scripts call them directly):
- `uv` — https://docs.astral.sh/uv/ (runs the Python steps; auto-installs faster-whisper + pillow on first run, no manual pip)
- `ffmpeg` + `ffprobe` — keyframes + audio extraction

`python3`, `curl`, and `jq` are assumed present. On macOS: `brew install uv ffmpeg jq`.

> **Transcription is local.** tokscript provides the video *listing* and the *download link*; the audio is transcribed on your machine with faster-whisper (`small.en` by default; `WHISPER_MODEL=medium.en` to override). First run downloads the model (~0.5 GB) and builds the venv, then it's cached.

**3. Handles.** Either name them inline when you trigger the skill, or create a `competitor-list.md` in your project root with an `## Instagram` and/or `## TikTok` section of profile URLs — the skill defaults to the first 5 handles total (order = priority).

## Output

Writes `research/Competitor-Research_<timestamp>.html` and auto-opens it. Auto-open uses macOS `open`; on Linux/Windows the file still writes — open it manually (or swap the `subprocess.run(["open", …])` call near the bottom of `scripts/build-report.py` to `xdg-open` / `os.startfile`).
