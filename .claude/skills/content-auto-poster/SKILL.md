---
name: content-auto-poster
description: "Turns a content bank into a scheduled posting plan and either (a) a CSV you bulk-import into a scheduler (Metricool / Publer / Later / Buffer) that auto-posts for you, or (b) direct-publishes Instagram Reels via the Instagram Graph API. Reads a posts.json (caption + media URL + keyword), builds a dated schedule with schedule-builder.py, and writes a scheduler-ready CSV; optionally publishes each reel with ig_publish.py once an IG token is configured. Appends the comment-keyword CTA as the first comment. TikTok is scheduled via CSV (its API needs separate approval). Triggers: auto post, schedule my reels, post my content, content calendar, bulk schedule, publish to instagram."
---

# Content Auto-Poster — Schedule + Publish

Two honest modes (Instagram/TikTok only publish via official APIs or a scheduler — there's no key-less shortcut):

- **Mode A — Schedule + bulk-export (works for everyone):** build a dated plan and a CSV you import into a scheduler (Metricool / Publer / Later / Buffer). The scheduler auto-posts.
- **Mode B — Direct publish (optional, IG only):** publish Reels straight from `ig_publish.py` via the Instagram Graph API, once a token is set up (see the manual).

`<SKILL_DIR>` = this skill's folder.

---

## STEP 1 — Build the posts list

Gather the content into `posts.json` — a list of `{caption, media, hashtags, keyword}`:
- `caption` — the full caption in the brand voice (hook in the caption is fine; the offer goes here).
- `media` — a **public https URL** to the video file (required for Mode B; for Mode A a URL or a local filename your scheduler accepts).
- `hashtags` — optional string.
- `keyword` — optional; appended as the first comment ("Comment CLOSER …").

If the user has a content doc (e.g. reel scripts), generate `posts.json` from it. A sample lives at `<SKILL_DIR>/scripts/posts.sample.json`.

## STEP 2 — Build the schedule + CSV (always)

```
python3 <SKILL_DIR>/scripts/schedule-builder.py posts.json \
  --start <YYYY-MM-DD> --times 09:00,17:00 --days Mon,Tue,Wed,Thu,Fri --out schedule.csv
```

Prints the plan and writes `schedule.csv` (columns: date, time, caption, first_comment, media, hashtags). Relay the printed plan to the user.

## STEP 3a — Mode A: hand off to a scheduler

Tell the user to **bulk-import `schedule.csv`** into their scheduler (the manual maps the columns for Metricool / Publer / Later / Buffer). The scheduler publishes at the scheduled times. Done — no API token needed.

## STEP 3b — Mode B: direct-publish to Instagram (optional)

Only if the user has configured the Instagram Graph API (see the manual). For each post:

```
IG_USER_ID=… IG_ACCESS_TOKEN=… python3 <SKILL_DIR>/scripts/ig_publish.py \
  --video-url "<public mp4 url>" --caption "<caption>" --first-comment "Comment CLOSER 👇" --share-to-feed
```

Run with `--dry-run` first to confirm. Never store or print the token. Requires an IG **Business/Creator** account, a public video URL, and a token with `instagram_content_publish`.

---

## Rules
- **Never invent a posting capability.** If no scheduler and no IG token are set up, stop at Mode A's CSV and tell the user the two setup paths.
- **Never store, log, or commit tokens.** `ig_publish.py` reads them from the environment only.
- **TikTok = scheduler only** here (CSV). Its Content Posting API needs separate app review.
- The CSV and `posts.json` are the durable artifacts; publishing is the scheduler's or the API's job.
