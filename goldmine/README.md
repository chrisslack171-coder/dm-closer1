# GoldMine — Find the Pain. Mine the Gold.

Interviews the user to find their niche, then **live-scrapes Reddit and YouTube**
(via Apify) to surface real buyer pain points and trending content — and turns
the loudest pain into a digital product concept plus ready-to-post content.

**The user's journey:**

| Stage | What happens |
|---|---|
| 01 The Interview | AI interviews them (max 4 questions) and produces a research plan: subreddits, Reddit searches, YouTube queries — all editable |
| 02 The Dig Site | They review/adjust where to dig |
| 03 The Dig | Live Apify scrape of Reddit + YouTube (1–3 min, progress shown) |
| 04 The Gold | Pain points ranked by heat with verbatim buyer quotes, plus trending content patterns |
| 05 The Product | Product concept (title, promise, outline, anchored price) + 6 posts modeled on the trends + a first-line DM. Downloadable kit |

## Deploy

1. Import this folder as a new Vercel project (root: `goldmine/`).
2. Environment variables:
   - `ANTHROPIC_API_KEY` — required (interview, analysis, build)
   - `APIFY_TOKEN` — required for the live scrape (apify.com → Settings → API tokens; free tier includes $5/mo of usage)
   - `ACCESS_CODE` — optional buyer gate
   - `REDDIT_ACTOR` / `YOUTUBE_ACTOR` — optional overrides; defaults are
     `trudax~reddit-scraper-lite` and `streamers~youtube-scraper`
3. Edit `ALLOWED` domains in `api/_utils.js` before launch.

**Before first launch:** run one dig end-to-end yourself. If an actor's input
schema has changed (Apify actors update over time), adjust the input builders
at the top of `api/research.js` — the actor's store page shows its current
input schema.

## Cost per user run (approximate)

- Reddit scrape (≤60 items): ~$0.05–0.20
- YouTube scrape (≤25 videos): ~$0.05–0.25
- AI calls (interview + analysis + build): ~$0.05–0.15

Roughly **$0.15–0.60 per full run**. Price the product accordingly (e.g. $47–$97
with a limited number of digs, enforced by rotating the `ACCESS_CODE` or adding
accounts later). TikTok/Instagram actors can be added the same way in
`api/research.js` when you're ready — they cost more per result.

## Local dev

```bash
npm install
npm run dev        # frontend only; API routes need `vercel dev` or a deploy
```
