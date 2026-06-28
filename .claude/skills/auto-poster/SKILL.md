---
name: auto-poster
description: "Post or schedule a provided video directly through Zernio. Input is a local video path or public video URL. If no caption is provided, transcribe the video with whisper.cpp (tiny.en by default) and generate a caption from that transcript. No Notion lookup or browser download. Triggers: post this video, post /path/to/video.mp4, schedule this video, queue this video, publish reel, post to instagram, post to zernio."
---

# Auto Poster

Take the video the user gives you and post it through Zernio.

This skill does one job with one optional prep step:

`provided video -> optional whisper.cpp caption -> Zernio`

Zernio posting should feel like:

```js
await fetch("https://zernio.com/api/v1/posts", {
  method: "POST",
  headers: { Authorization: `Bearer ${ZERNIO_API_KEY}` },
  body: JSON.stringify({
    content: "Caption goes here",
    platforms: [{ platform: "instagram", accountId: "..." }],
    mediaItems: [{ type: "video", url: "https://example.com/demo.mp4" }],
    publishNow: true
  })
});
```

Zernio's public examples sometimes show the shorthand shape `text`, `platforms`, and `mediaUrls`. The helper script uses the documented OpenAPI shape: `content`, `mediaItems`, and platform targets with account IDs.

## What This Skill Does Not Do

- Does not search Notion.
- Does not download from Frame.io or Google Drive.
- Does not update pipeline status.
- Does not run the full content production chain.

If the user wants those steps, use the relevant upstream skill first, then come back here with the final video file.

## Inputs

Required:

- Local video path, e.g. `/Users/you/Videos/final.mp4`
- Or a public direct video URL, e.g. `https://.../video.mp4`

Optional:

- Caption text or caption file.
- If no caption is provided, generate one from a whisper.cpp transcript.
- Platforms: default `instagram,tiktok,youtube`.
- Mode: default `shareNow`.
- Schedule time for `customScheduled`.
- YouTube title. Default is the filename or caption first line.

## Prerequisites

`.env` (in the skill directory) must contain:

Start from `.env.example` and fill in the real values.

```bash
ZERNIO_API_KEY=
ZERNIO_ACCOUNT_INSTAGRAM=
ZERNIO_ACCOUNT_TIKTOK=
ZERNIO_ACCOUNT_YOUTUBE=
```

Aliases also work:

```bash
ZERNIO_ACCOUNT_ID_INSTAGRAM=
ZERNIO_ACCOUNT_ID_TIKTOK=
ZERNIO_ACCOUNT_ID_YOUTUBE=
```

Optional:

```bash
ZERNIO_API_URL=https://zernio.com/api/v1
ZERNIO_PROFILE_ID=
ZERNIO_QUEUE_ID=
ZERNIO_TIMEZONE=America/Chicago
```

`ZERNIO_PROFILE_ID` is required only for `addToQueue`.

System tools used by the helpers: `python3`, `ffmpeg`, `curl`, `git`, `make`, `gcc`. The transcriber will `pip install cmake` on first run if it's missing.

If you don't have all the account IDs, you can fetch them with `GET https://zernio.com/api/v1/accounts` using the API key — the response is `{ accounts: [{ _id, platform, displayName, ... }] }`.

## Fast Path

Use the helper script:

```bash
python3 scripts/post_to_zernio.py \
  "/absolute/path/to/video.mp4" \
  --caption-file "$CAPTION_FILE" \
  --platforms instagram,tiktok,youtube \
  --mode shareNow
```

Where `$CAPTION_FILE` is a path you created in this session — not a hardcoded shared path. See "Temp files" below.

For a public video URL:

```bash
python3 scripts/post_to_zernio.py \
  "https://example.com/video.mp4" \
  --caption "Caption goes here" \
  --platforms instagram,tiktok \
  --mode addToQueue
```

If the user did not provide a caption, run the transcriber and capture the path it prints to stdout:

```bash
TRANSCRIPT_FILE=$(scripts/transcribe_for_caption.sh "/absolute/path/to/video.mp4")
```

Then read `$TRANSCRIPT_FILE`, write a caption to a path you control, and pass that to `--caption-file`.

For a scheduled post:

```bash
python3 scripts/post_to_zernio.py \
  "/absolute/path/to/video.mp4" \
  --caption-file "$CAPTION_FILE" \
  --mode customScheduled \
  --due-at "2026-05-18T12:00:00" \
  --timezone "America/Chicago"
```

For a draft:

```bash
python3 scripts/post_to_zernio.py \
  "/absolute/path/to/video.mp4" \
  --caption-file "$CAPTION_FILE" \
  --mode draft
```

## Transcription (whisper.cpp)

`scripts/transcribe_for_caption.sh` uses whisper.cpp with the `ggml-tiny.en` model by default. This was chosen after testing:

- `tiny.en` is ~75 MB and transcribes a 90-second video in ~2 seconds on CPU.
- `faster-whisper` + `onnxruntime` + `av` need ~3 GB of disk just for deps, which doesn't fit in some sandboxed environments. Avoid it unless you've confirmed disk headroom.
- The script ffmpeg-extracts 16 kHz mono audio first so whisper.cpp processes a few MB instead of hundreds.

Override the model with `AUTO_POSTER_WHISPER_MODEL=base.en` (or `small.en`) if you want more quality; expect ~150 MB / ~500 MB and a few seconds longer per run.

The whisper.cpp build and downloaded models are cached at `~/.cache/auto-poster/whisper.cpp/`. First run takes 3–5 minutes (clone + build + model download). Every run after that reuses the cache and finishes in seconds. Override the cache location with `AUTO_POSTER_WHISPER_DIR`.

## Temp files (security)

Do not write transcripts, captions, or downloaded media to predictable shared paths like `/tmp/auto-poster-caption.txt`. Anyone with write access to `/tmp` on the host can pre-seed those files and inject content into a post.

Instead:

- Let `transcribe_for_caption.sh` choose its own output path (it uses `mktemp` with mode 600) and read whatever path it prints.
- When you need to write a caption, use a session-scoped path you create — e.g. the agent's outputs directory or `"$(mktemp -t auto-poster-caption.XXXXXXXX)"`.
- Before reading any file you didn't just create, verify it's owned by the current user (`stat -c '%U' "$f"`) and was modified after the session started. If either check fails, refuse and ask the user.

## Execution Rules

1. If the user did not provide a video path or URL, ask for the video.
2. If the user provided a caption, use it.
3. If the user did not provide a caption, run `transcribe_for_caption.sh`, generate a caption from the transcript, and save it to a session-scoped file you created.
4. If the video is a local file, run `post_to_zernio.py` with that path. The script uploads it through Zernio's presigned media upload flow.
5. If the video is already a public URL, pass it directly as the media URL.
6. Default to all configured platforms unless the user names specific platforms.
7. For YouTube, set `--yt-title` if the user provides one. Otherwise use the filename or first caption line.
8. Report Zernio post IDs, statuses, platform URLs, and errors. Do not mark any outside system as posted.
9. For `shareNow` on the first post of a session — or any post going to a real public account — show the user the caption and confirm before publishing.

## Caption Rules

Generate the caption from the transcript, not from a generic template.

- If the transcript includes a real comment/DM CTA the user said on camera, put that CTA on line 1 and repeat it at the end.
- If there is no spoken CTA, do not manufacture one. Use the strongest hook/take from the transcript and keep it casual.
- Keep it direct, conversational, and short enough for IG/TikTok.
- Use line breaks. Avoid numbered lists unless the video itself is clearly a numbered list.

## Supported Modes

- `shareNow`: sends `publishNow: true`.
- `addToQueue`: sends `queuedFromProfile`, using `ZERNIO_PROFILE_ID`.
- `customScheduled`: sends `scheduledFor` and `timezone`.
- `draft`: sends `isDraft: true`.

For `customScheduled`, `--due-at` is required.

## Platform Metadata

The script sends:

- Caption as top-level `content`.
- Video as `mediaItems: [{ type: "video", url }]`.
- Platforms as `{ platform, accountId }` targets from `.env`.
- YouTube title as top-level `title` when posting to YouTube.

## Notes

- Zernio API base URL is `https://zernio.com/api/v1`.
- Zernio uses bearer auth with `ZERNIO_API_KEY`.
- Local files are uploaded via `POST /v1/media/presign`, then `PUT` to the returned upload URL, then posted with the returned `publicUrl`.
- Zernio also has a shorthand examples style using `text`, platform names, and `mediaUrls`; use the helper unless the user explicitly asks for the raw shorthand payload.

## Resilience (built into the helper)

The helper is hardened against the failure modes that bit us in real runs. You normally don't need to do anything — just know how it behaves:

- **Media reachability check reads the HTTP status code, not a substring of the header dump.** A `Content-Length` like `102040443` contains "404" and used to false-positive the old check. It now retries a few times (uploads can 404 briefly while they propagate) and is a *soft warning* for media we uploaded ourselves (the `PUT` already succeeded and Zernio reads it server-side) — it only hard-fails for a user-supplied URL.
- **A timed-out create never duplicates.** `POST /posts` can succeed server-side even when the client call times out. The helper uses one stable `x-request-id` per logical post and, on any network/timeout error, *reconciles* against `GET /posts` (matching the exact caption, recent posts only) before deciding anything. If the post already landed it reports `source: recovered-after-timeout`; only if nothing is found does it retry, reusing the same request id. So never re-run the script by hand after a timeout — let it reconcile.
- **Create timeout is 240s** (fan-out to 5 platforms takes a while), vs. the old 120s that gave up too early.
- **`source` in the output** tells you whether the post was `created` or `recovered`.

Flags for edge cases:

- `--wait-seconds N` — poll the created post until every platform reaches a terminal state (published/failed), up to N seconds. Good for an accurate final report.
- `--skip-verify` — skip the media reachability check entirely.
- `--max-retries N` — safe create retries (default 1); each is reconcile-guarded so it can't duplicate.
