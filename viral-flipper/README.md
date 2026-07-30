# Viral Flipper — extract, flip, batch

Paste saved Instagram reel URLs → the app pulls each video's spoken script,
rewrites it in **your** voice (same viral structure, your positioning), and
exports a CSV with the competitor's script next to yours — ready for HeyGen
bulk voice + faceless video creation.

Same protected architecture as DM Closer: all keys and prompts live in
serverless functions (`api/`), never in the browser.

## The pipeline

1. **Extract** (`api/extract.js`) — Apify's Instagram Scraper fetches the
   video file + caption + handle, then OpenAI Whisper transcribes the audio.
2. **Flip** (`api/flip.js`) — Claude rewrites the transcript in your voice
   using the voice profile you type into the app (kept on your device).
3. **CSV** — one row per reel: `title, competitor_handle, source_url,
   hook_type, competitor_script, my_script`.
4. **HeyGen** — build ONE faceless video template with a `{{my_script}}`
   variable and your cloned voice, then Bulk Create → upload the CSV →
   one video per row.

## Deploy (one time)

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. Vercel → **Add New Project** → import this repo → set **Root Directory**
   to `viral-flipper` (this makes it its own app, separate from DM Closer).
3. Settings → Environment Variables, add all three, then redeploy:
   - `APIFY_TOKEN` — console.apify.com → Settings → API tokens. The
     Instagram Scraper actor is pay-per-result (fractions of a cent per post).
   - `OPENAI_API_KEY` — only used for Whisper transcription (~$0.006/min).
   - `ANTHROPIC_API_KEY` — the script flip (same key as DM Closer works).
4. Open the Vercel URL, paste your voice profile once (it saves locally),
   drop in reel URLs, hit **Extract & Flip**, export the CSV.

## Notes on scale

- The app processes 2 reels at a time (`CONCURRENCY` in
  `src/ViralFlipper.jsx`). Raise it once your Apify/OpenAI quotas are proven.
- Only **public** posts work — the scraper can't see private accounts.
  "Saved" posts on your IG account aren't reachable by API; keep a list of
  the URLs instead (Share → Copy Link on each saved post).
- Batches of 10–30 URLs per run are the sweet spot; the CSV accumulates
  everything marked *done*, so you can run several batches then export once.
- Costs per reel roughly: scrape <$0.01 + Whisper ~$0.01 + Claude ~$0.01.
  A 100-video batch costs a few dollars, before HeyGen credits.
- Edit either script inline before exporting — the CSV takes your edits.
