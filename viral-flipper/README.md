# Viral Flipper — extract, blueprint, flip, remix, batch

Paste viral video URLs — **Instagram, TikTok, YouTube (Shorts), or a direct
.mp4 link** — and the app pulls each video's spoken script,
reverse-engineers the viral **blueprint** (hook mechanism, structure beats,
pacing, tone, CTA, why it worked), rewrites the script in **your** voice,
lets you **remix** any result with custom instructions ("make it funnier",
"shorten to 30s" — every version saved), and exports a CSV with the
competitor's script next to yours — ready for HeyGen bulk voice + faceless
video creation. Your library persists on your device between sessions.

Same protected architecture as DM Closer: all keys and prompts live in
serverless functions (`api/`), never in the browser.

## The pipeline

1. **Extract** (`api/extract.js`) — platform-aware:
   - Instagram → Apify Instagram Scraper → video file → Whisper transcription
   - TikTok → Apify TikTok Scraper → TikTok's own subtitles (free), Whisper fallback
   - YouTube → Apify YouTube Transcript Scraper (captions, no Whisper needed)
   - Direct .mp4 → straight to Whisper
2. **Flip** (`api/flip.js`) — Claude reverse-engineers the blueprint and
   rewrites the script in your voice (persistent voice profile, kept on your
   device). If a cover frame is available it's analyzed too. The same
   endpoint powers remixing: previous script + your instruction → new version.
3. **CSV** — one row per video: `title, platform, competitor_handle,
   source_url, views, hook_type, tone, cta, competitor_script, my_script`.
4. **HeyGen** — build ONE faceless video template with a `{{my_script}}`
   variable and your cloned voice, then Bulk Create → upload the CSV →
   one video per row.

## Deploy (one time)

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. Vercel → **Add New Project** → import this repo → set **Root Directory**
   to `viral-flipper` (this makes it its own app, separate from DM Closer).
3. Settings → Environment Variables, then redeploy:
   - `APIFY_TOKEN` — console.apify.com → Settings → API tokens. The free
     plan includes ~$5/month of credit — at fractions of a cent per post
     that covers hundreds of extractions monthly before you pay anything.
   - `GROQ_API_KEY` — console.groq.com → API Keys. Groq runs Whisper on a
     genuinely FREE tier — this makes transcription cost $0. (Or set
     `OPENAI_API_KEY` instead for paid OpenAI Whisper; Groq wins if both set.)
   - `ANTHROPIC_API_KEY` — the script flip (same key as DM Closer works).
4. Open the Vercel URL, paste your voice profile once (it saves locally),
   drop in reel URLs, hit **Extract & Flip**, export the CSV.

## Notes on scale

- The app processes 2 videos at a time (`CONCURRENCY` in
  `src/ViralFlipper.jsx`). Raise it once your Apify/OpenAI quotas are proven.
- Only **public** posts work — the scraper can't see private accounts.
  "Saved" posts on your IG account aren't reachable by API; keep a list of
  the URLs instead (Share → Copy Link on each saved post).
- Batches of 10–30 URLs per run are the sweet spot; the library accumulates
  everything marked *done* across runs (and across sessions — it's saved in
  your browser), so run several batches then export one CSV.
- Costs per video roughly: scrape <$0.01 + Whisper ~$0.01 + Claude ~$0.01.
  TikTok and YouTube are usually cheaper (their captions skip Whisper).
  A 100-video batch costs a few dollars, before HeyGen credits.
- Edit either script inline before exporting — the CSV takes the version
  you have selected, including your edits.
- TikTok video downloads (the Whisper fallback when a video has no
  subtitles) can be flaky — TikTok rotates its CDN URLs. Retry usually
  fixes it; the subtitle path covers most videos anyway.
