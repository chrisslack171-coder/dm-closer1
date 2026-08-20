# scripts/

## scrape-reels.mjs — top Instagram reels for a hashtag

Runs an Apify Instagram scraper, keeps the reels posted in the last N days,
sorts them by view count and writes the top N to a JSON file.

```bash
export APIFY_TOKEN=apify_api_xxx        # console.apify.com → Settings → API tokens
npm run scrape:reels                     # #aitools, last 30 days, top 50 → reels_data.json
```

Same thing spelled out, plus the other flags:

```bash
node scripts/scrape-reels.mjs \
  --hashtag aitools --days 30 --top 50 --out reels_data.json
node scripts/scrape-reels.mjs --hashtag aitools --dry-run   # show the actor input, spend nothing
node scripts/scrape-reels.mjs --username someaccount        # an account's reels instead
node scripts/scrape-reels.mjs --help
```

### Which actor

Apify's **Instagram Reel Scraper** (`apify/instagram-reel-scraper`) takes
*usernames* — it lists an account's reels and has no hashtag input. Hashtag
search lives in `apify/instagram-hashtag-scraper`, which is the default here,
and in the general `apify/instagram-scraper`. Override with `--actor`; the reel
scraper is selected automatically when you pass `--username`.

### How the ranking is built

The actor returns a mixed feed, so the script filters before it sorts:

1. drop anything that isn't a reel (image posts, carousels);
2. drop posts older than `--days`, and any post with no timestamp;
3. drop reels with no view count — they can't be ranked;
4. sort by views, descending, and keep `--top`.

That attrition is why it requests `--top × 6` posts by default. If the run comes
back with fewer than you asked for, raise `--limit` or widen `--days`. Every
count is recorded in the output so you can see where the items went.

### Output

```jsonc
{
  "query": { "hashtag": "#aitools" },
  "actor": "apify~instagram-hashtag-scraper",
  "scrapedAt": "...",
  "windowDays": 30,
  "sortedBy": "views",
  "counts": { "scraped": 300, "reels": 240, "undated": 0,
              "inWindow": 96, "withViewCount": 94, "returned": 50 },
  "reels": [
    { "rank": 1, "id": "...", "shortCode": "...", "url": "...", "username": "...",
      "caption": "...", "hashtags": [], "postedAt": "...", "views": 0, "likes": 0,
      "comments": 0, "durationSec": 0, "videoUrl": "...", "thumbnailUrl": "..." }
  ]
}
```

Field names vary between Instagram actors, so each reel is normalized from every
spelling seen in the wild (`videoPlayCount` / `playsCount` / `videoViewCount`,
`timestamp` / `takenAtTimestamp`, …). Only public hashtags and accounts are
reachable.

`APIFY_API_BASE` overrides the API host — used to test the script against a
local stub without spending credits.

---

## analyze-reels.mjs — turn the scrape into a marketing brief

Reads what `scrape-reels.mjs` wrote and has Claude find the patterns across the
winners — hook shapes, content angles, CTA placement, format — then turn them
into reels you can film.

```bash
export ANTHROPIC_API_KEY=sk-ant-...      # or run `ant auth login`
npm run scrape:reels                      # → reels_data.json
npm run analyze:reels                     # → reels_analysis.json + reels_analysis.md
```

```bash
node scripts/analyze-reels.mjs \
  --audience "solo founders" \
  --offer 'a $47 AI workflow playbook' \
  --effort xhigh                          # low | medium | high | xhigh | max
node scripts/analyze-reels.mjs --dry-run  # print the prompt, call no API
node scripts/analyze-reels.mjs --help
```

`--audience` and `--offer` are optional but do most of the work in sharpening
the content ideas — without them the brief describes the niche rather than your
position in it.

### How the call is built

- **`claude-opus-5`** with **adaptive thinking** — the model paces its own
  reasoning depth across the captions; `--effort` sets the ceiling.
- **Structured outputs** (`output_config.format`, a closed JSON schema) so the
  brief is a guaranteed shape rather than prose to be regex'd apart.
- **Server-side fallback** (`fallbacks: "default"`) — if a safety classifier
  declines the request, the API re-runs it on the recommended substitute rather
  than handing back a refusal. Routed by refusal category, so there's no model
  to pin or maintain. Drop the `betas` and `fallbacks` lines to opt out.
- **Engagement rates are computed in the script**, not by the model. Arithmetic
  is the one thing the script does better, and it frees the model to reason
  about *why* a reel with rank-3 views has rank-30 engagement.
- A `countTokens` pre-flight prints the input cost before the real call.

Two files come out: `reels_analysis.json` (structured, for piping onward) and
`reels_analysis.md` (readable, for you).
