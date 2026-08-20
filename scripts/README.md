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
