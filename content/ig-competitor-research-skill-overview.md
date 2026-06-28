# IG Competitor Research — Skill Overview

A Claude skill that researches what's actually working in your niche on **Instagram
and TikTok**, then breaks down the winning videos into a clean, visual report you can
model your content from.

---

## What it does

You give it competitor handles (or a saved list). It runs three phases automatically:

**1. Scrape & rank.** Pulls each competitor's recent short-form videos (tokscript MCP),
ranks them by **likes**, surfaces real **view counts**, and scores each one's
**breakout** — how far it beat that creator's own weekly median — so a small account's
outlier isn't buried under a big account's average post.

**2. Break down the winners.** For the top 3 per handle, it grabs the video, transcribes
it, and analyzes it into:
- the **hook** (the real first line — *not* the caption)
- the **hook type** (spoken vs. on-screen text)
- the **content format** (talking head, listicle, demo, story…)
- the **full transcript**
- a one-line **concept breakdown**
- **why it worked**

**3. Build the report.** Assembles it all into a self-contained, visual **HTML report** —
ranked cards, view + breakout badges, keyframe galleries, one-click-copy transcripts,
"View original" links — plus a one-paragraph **Pattern** of what repeats across the pool.

## What you get

A single shareable report that tells you at a glance: which videos are winning, the
exact hooks driving them, the formats that recur, and the one pattern to copy this week.

## The core insight it's built around

**The hook is never the caption.** Most people copy the wrong thing. This skill separates
the *reach engine* (the hook/format that wins attention) from the *offer* (which lives in
the caption behind a comment-keyword → DM funnel) — so you model what actually drives views.

## How it's different from just looking at competitors

- **Ranks by breakout, not vanity** — true outliers surface regardless of account size.
- **Transcribes the real hooks** — you see the first spoken line, not the caption.
- **Repeatable** — a documented pattern every week, not a vibe.
- **Scales** — scripts do the ranking and report-building; it handles multiple competitors without you sorting anything by hand.

## What it needs to run

| Requirement | For |
|-------------|-----|
| **tokscript MCP** (Pro/Premium) | scraping IG/TikTok profiles |
| `uv` | runs the Python steps (auto-installs faster-whisper + pillow) |
| `ffmpeg` + `ffprobe` | keyframes + audio |
| `jq`, `python3`, `curl` | assumed present |
| Handles | inline, or in a `competitor-list.md` |

## How to use it

1. Add competitor profile URLs to `competitor-list.md` (IG and/or TikTok).
2. Run `/ig-competitor-research` (no args uses the list; or pass handles).
3. Open the report in `research/`, read the Pattern, model the winners.
