# content-auto-poster — setup

Turns a content bank into a dated posting schedule + a scheduler-ready CSV, and
(optionally) direct-publishes Instagram Reels via the Instagram Graph API.

## Install
Drop this folder into `~/.claude/skills/content-auto-poster/` (everywhere) or
`<project>/.claude/skills/content-auto-poster/` (one project). Then `/content-auto-poster`.

## Two modes
- **A — Schedule + CSV (no API):** build `schedule.csv`, bulk-import into Metricool /
  Publer / Later / Buffer; the scheduler auto-posts.
- **B — Direct publish (IG only):** `ig_publish.py` posts Reels via the Instagram Graph
  API once you set `IG_USER_ID` + `IG_ACCESS_TOKEN`. See the manual for the token steps.

## Prerequisites
- `python3` (stdlib only — no pip).
- Mode A: a scheduler account that accepts CSV import.
- Mode B: IG Business/Creator account + Meta app + long-lived token + public video URLs.

No tokens are stored in the skill; `ig_publish.py` reads them from the environment.
