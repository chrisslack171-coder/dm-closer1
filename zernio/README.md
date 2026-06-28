# Zernio autoposter

Watches a folder **on your own computer** and posts every new video to
[Zernio](https://zernio.com) as a **draft** (Instagram + TikTok by default).

It runs locally because that's where your video files are — a cloud assistant
can't read your `C:\` drive, but this script can. Your API key stays on your
machine and never goes through chat.

Zero dependencies: just Node 18 or newer.

---

## One-time setup

1. **Install Node** (18+; 20.6+ recommended) — https://nodejs.org → "LTS".
2. **Get this code onto your PC.** In a terminal:
   ```sh
   git clone <your repo url>
   cd dm-closer1
   git checkout claude/zernio-autoposter-video-draft-dedmyg
   ```
   (Or `git pull` if you already have it.)
3. **Create your config.** Copy the example and edit it:
   ```sh
   # Windows (PowerShell)
   copy zernio\.env.example zernio\.env
   # macOS / Linux
   cp zernio/.env.example zernio/.env
   ```
   Open `zernio/.env` and set at least:
   - `ZERNIO_API_KEY` — your key
   - `ZERNIO_WATCH_DIR` — the folder to watch, e.g. `C:/Users/chris/Videos/Captures`

   `zernio/.env` is git-ignored, so your key is never committed.

---

## Run it

**Watch mode** (the automatic one):
```sh
node zernio/autopost.mjs
```
Leave that terminal open. Drop a new `.mp4` (or `.mov`/`.avi`/`.webm`) into the
watched folder and it gets posted as a draft automatically. Existing files in
the folder are ignored — only new drops are posted.

**Post one file** (handy for a first test):
```sh
node zernio/autopost.mjs --once "C:\Users\chris\Videos\Captures\my clip.mp4"
```

Then open your Zernio dashboard → Drafts to review and publish.

---

## How it works

For each new video the script runs the standard Zernio upload flow:

1. `POST /media/presign` → gets a temporary upload URL + a permanent `publicUrl`.
2. `PUT` the file's bytes straight to that upload URL (streamed, so big files
   don't eat memory; up to 5 GB).
3. `POST /posts` with the video in `mediaItems` and **no** `scheduledFor` /
   `publishNow` → saved as a **draft**.

It waits until a file stops growing before uploading, so a still-recording clip
isn't posted half-written. A `.zernio-posted.json` ledger in the watched folder
records what's been posted so nothing is sent twice, even across restarts.

---

## Captions

- Set a default for every post with `ZERNIO_CAPTION` in `.env`.
- To caption one specific video, drop a `.txt` file next to it with the same
  name — `clip.mp4` → `clip.txt`. Its contents become that post's caption and
  override the default.

---

## Config reference

All via `zernio/.env` (see `.env.example`):

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ZERNIO_API_KEY` | yes | — | Your Zernio API key |
| `ZERNIO_WATCH_DIR` | yes (watch mode) | — | Folder to monitor |
| `ZERNIO_PLATFORMS` | no | `instagram,tiktok` | Accounts to draft to |
| `ZERNIO_CAPTION` | no | _(empty)_ | Default caption |
| `ZERNIO_TIKTOK_PRIVACY` | no | `PUBLIC_TO_EVERYONE` | TikTok draft privacy level |
| `ZERNIO_STABLE_MS` | no | `3000` | Wait for file size to settle (ms) |
| `ZERNIO_API_BASE` | no | `https://zernio.com/api/v1` | API base URL |

---

## Notes

- **TikTok drafts** include the consent/privacy flags TikTok's API requires, so
  the draft is publish-ready from the Zernio dashboard. Make sure
  `ZERNIO_TIKTOK_PRIVACY` is a value your creator account allows.
- **Keep the terminal open** for watch mode. To run it unattended, use a process
  manager (e.g. `pm2`) or a Windows Scheduled Task — ask and I'll add that.
- **Keys belong in `.env`**, never in the code. The `.env` file is git-ignored.
