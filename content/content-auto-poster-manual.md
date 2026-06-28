# Content Auto-Poster — Download, Install & Manual

A Claude skill that turns your content bank into a **dated posting schedule** and either
**(A)** a CSV you bulk-import into a scheduler that auto-posts for you, or **(B)**
direct-publishes Instagram Reels via the Instagram Graph API.

> **Honest note:** Instagram and TikTok only let you publish through their official APIs
> or an approved scheduler. There is no key-less "just auto-post" shortcut. This skill
> automates everything up to the publish, and (in Mode B) the publish itself once you've
> done a one-time token setup.

---

## Part 1 — Download & install the skill

1. **Download** `content-auto-poster.zip` and **unzip** it. You get a folder
   `content-auto-poster/`.
2. **Move it into your Claude skills directory:**
   - Everywhere on your machine: `~/.claude/skills/content-auto-poster/`
   - One project only: `<project>/.claude/skills/content-auto-poster/`
3. **Restart Claude Code**, type `/`, and **`/content-auto-poster`** appears.

**Requirements:** `python3` (the scripts are stdlib-only — nothing to pip install).
For Mode A you need a scheduler account; for Mode B, an Instagram setup (Part 4).

---

## Part 2 — Build your posts list

Create a `posts.json` — a list of posts:

```json
[
  {
    "caption": "Your full caption in your voice … Comment CLOSER 👇",
    "media": "https://your-cdn.com/reel.mp4",
    "hashtags": "#dmsales #coursecreator",
    "keyword": "CLOSER"
  }
]
```

- `caption` — the full caption.
- `media` — a **public https URL** to the video (required for Mode B; for Mode A a URL or a filename your scheduler accepts).
- `hashtags` — optional.
- `keyword` — optional; becomes the **first comment** ("Comment CLOSER …").

> Tip: just ask Claude — *"build posts.json from my reel scripts"* — and it fills this in
> from your content bank. A sample is at `scripts/posts.sample.json`.

---

## Part 3 — Mode A: schedule + bulk-import (works for everyone)

1. Run the schedule builder:
   ```
   python3 scripts/schedule-builder.py posts.json \
     --start 2026-07-01 --times 09:00,17:00 --days Mon,Tue,Wed,Thu,Fri --out schedule.csv
   ```
   - `--times` = how many per day + when (e.g. two reels/day at 9am & 5pm).
   - `--days` = which weekdays to post.
2. It writes **`schedule.csv`** (date, time, caption, first_comment, media, hashtags) and prints the plan.
3. **Bulk-import `schedule.csv` into your scheduler:**

   | Scheduler | Where to import |
   |-----------|-----------------|
   | **Publer** | Create → Bulk → Import CSV |
   | **Metricool** | Planning → Import/Autolists (CSV) |
   | **Later** | Bulk Create / CSV upload |
   | **Buffer** | (no native CSV — use Publer/Metricool, or paste posts) |

   Map the columns when prompted (date, time, caption, media). Add the `first_comment`
   column as the **auto first comment** if your scheduler supports it.
4. The scheduler publishes at the scheduled times. **No API token needed.** This is the
   easiest path and works for **Instagram *and* TikTok**.

---

## Part 4 — Mode B: direct-publish to Instagram (optional)

Publishes Reels straight from the script. One-time setup, then it's fully automated.

### 4.1 What you need
- An Instagram **Business or Creator** account, linked to a **Facebook Page**.
- A **Meta (Facebook) developer app** with the Instagram Graph API product.
- A **long-lived access token** with `instagram_content_publish` (+ pages permissions).
- Your **IG_USER_ID** (the Instagram Business account ID).
- Each video hosted at a **public https URL** (IG pulls the file from there).

### 4.2 Get the token (once)
1. Go to **developers.facebook.com** → create an app (type: Business).
2. Add the **Instagram Graph API** product; link your Facebook Page + IG account.
3. In the **Graph API Explorer**, generate a User token with these permissions:
   `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`.
4. **Exchange it for a long-lived token** (lasts ~60 days) via the token tool / the
   `/oauth/access_token?grant_type=fb_exchange_token` endpoint.
5. Find your **IG_USER_ID**: `GET /me/accounts` → your Page → `GET /{page-id}?fields=instagram_business_account`.

(Meta's docs: *Instagram Platform → Content Publishing*. The token must be refreshed
roughly every 60 days.)

### 4.3 Publish
Set the two env vars, then run per post (try `--dry-run` first):
```
export IG_USER_ID="17841400000000000"
export IG_ACCESS_TOKEN="EAAB...your-long-lived-token..."

python3 scripts/ig_publish.py \
  --video-url "https://your-cdn.com/reel.mp4" \
  --caption "Your caption … Comment CLOSER 👇" \
  --first-comment "Comment CLOSER and I'll send it 👇" \
  --share-to-feed
```
The script: creates the reel container → waits for processing → publishes → posts your
first comment. It prints the new media ID on success.

### 4.4 Safety
- The token is read from the **environment only** — never store it in `posts.json`, the
  repo, or a commit.
- Start with `--dry-run` to confirm the caption/video before going live.

---

## Part 5 — TikTok

TikTok's Content Posting API requires **separate app review/approval**, so this skill
**schedules TikTok via the CSV (Mode A)** rather than direct-posting. Import the same
`schedule.csv` into a scheduler that supports TikTok (Publer, Metricool, Later).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `set IG_USER_ID and IG_ACCESS_TOKEN` | Export both env vars (Part 4.3). |
| HTTP 400 on `/media` | Video URL must be public https + a supported MP4; check the IG_USER_ID. |
| `status: IN_PROGRESS` forever | Large/slow video — the script polls ~3 min; re-run, or host a smaller file. |
| Token expired | Long-lived tokens last ~60 days — regenerate (Part 4.2). |
| `/content-auto-poster` not showing | Open Claude Code inside the folder with `.claude/`, then restart. |
| Scheduler won't import CSV | Use Publer or Metricool (best CSV support); map columns when prompted. |

---

## Quick start (TL;DR)

1. Unzip → `~/.claude/skills/content-auto-poster/` → restart Claude → `/content-auto-poster`.
2. Build `posts.json` (or ask Claude to).
3. `schedule-builder.py … --out schedule.csv`.
4. **Easiest:** import `schedule.csv` into Publer/Metricool — done.
5. **Or** set up the IG token once and `ig_publish.py` posts Reels directly.
