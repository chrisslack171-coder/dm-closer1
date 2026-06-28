# ig-competitor-research — setup

Scans Instagram competitors, ranks their last-week posts by likes + breakout score, transcribes/analyzes each winner, and builds a self-contained HTML report. Claude drives the whole thing — you just trigger it ("research @handle_a @handle_b", or "content research" to use your competitor list).

## Install

Drop this folder into a skills directory:
- `<project>/.claude/skills/ig-competitor-research/` — for one project, or
- `~/.claude/skills/ig-competitor-research/` — to use it everywhere.

## Prerequisites

**1. Apify account + MCP (required, paid).** The scrape is one call to the `apify/instagram-post-scraper` actor. Connect the **Apify MCP server** in Claude Code and have credit on your account. Cost is ~$0.003/post (~$0.11 for 3 handles, ~$0.18 for 5). No API token or env vars — the OAuth MCP connection handles auth, and the dataset is pulled back through that same MCP (`get-actor-output`).

**2. System tools.** Install these (the scripts call them directly):
- `uv` — https://docs.astral.sh/uv/ (runs the Python steps; auto-installs faster-whisper + pillow on first run, no manual pip)
- `ffmpeg` + `ffprobe` — keyframes + audio extraction

`python3` and `curl` are assumed present. On macOS: `brew install uv ffmpeg`.

**3. Handles.** Either name them inline when you trigger the skill, or create a `competitor-list.md` in your project root with an `## Instagram` section of `instagram.com/<handle>/` URLs — the skill defaults to the first 5.

## Output

Writes `research/IG-Competitor-Research_<timestamp>.html` and auto-opens it. Auto-open uses macOS `open`; on Linux/Windows the file still writes — open it manually (or swap line ~425 of `scripts/build-report.py` to `xdg-open` / `os.startfile`).
