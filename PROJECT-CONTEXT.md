# Project context — handoff brief

**Snapshot date:** 2026-09-08
**Repo:** `chrisslack171-coder/dm-closer1`
**Active branch:** `claude/instagram-reel-scraper-apify-q4ymq5`
**Purpose of this file:** bring another assistant fully up to speed on what exists,
what works, what doesn't, and what's open. Written to be pasted or uploaded whole.

Contains no API keys or secrets — only the *names* of the environment variables
each piece expects.

---

## 1. What this repo is

Three separate things share one repository. They are not integrated with each
other; they're tools for the same creator-marketing workflow.

| Piece | Path | What it is | Status |
|---|---|---|---|
| **DM Closer** | `/api/close.js`, `/src/DMCloser.jsx` | Web app that coaches you through closing sales conversations in Instagram DMs. The "closing system" prompt lives server-side so buyers can't view-source it. | Built, deploys to Vercel |
| **Viral Flipper** | `/viral-flipper/` | Takes a single video URL (IG / TikTok / YouTube / .mp4), scrapes it, transcribes it, has Claude reverse-engineer the script and rewrite it in your voice. Exports CSV for HeyGen. | Built, separate Vercel project |
| **Reel research scripts** | `/scripts/` | Node CLI tools added this session: scrape top-performing reels, then have Claude turn them into a marketing brief. | Built, **never run against live APIs** |

### Stack

- Vite + React 18, plain JavaScript (no TypeScript anywhere)
- Vercel serverless functions in `api/` directories
- Node ESM (`"type": "module"`) — all scripts are `.mjs`
- Deployed as two separate Vercel projects; `viral-flipper` uses Root Directory = `viral-flipper`

---

## 2. What was built this session

Three commits on `claude/instagram-reel-scraper-apify-q4ymq5`:

```
1a4491a  Track multiple hashtags and accounts from a source list
3d6cbdf  Add Claude-powered marketing analysis of scraped reels
e8f98b0  Add Apify-backed script for top hashtag reels by views
```

### `scripts/scrape-reels.mjs` (379 lines)

Runs an Apify Instagram scraper, filters the results to reels in a time window,
ranks by views, writes JSON.

```bash
export APIFY_TOKEN=...
npm run scrape:reels                    # #aitools, last 30 days, top 50 → reels_data.json
node scripts/scrape-reels.mjs --all     # every source in tracked-sources.json
node scripts/scrape-reels.mjs --dry-run # print the plan, spend nothing
```

Flags: `--hashtag`, `--username`, `--days`, `--top`, `--limit`, `--actor`, `--out`,
`--token`, `--timeout`, `--sources`, `--all`, `--dry-run`, `--help`.

Design decisions worth knowing:

- **Actor is chosen per source.** Apify's *Instagram Reel Scraper*
  (`apify/instagram-reel-scraper`) takes **usernames only** — it has no hashtag
  input. Hashtags go to `apify/instagram-hashtag-scraper`. This trips people up
  constantly. `--actor` overrides; a mismatched override fails with a clear error.
- Runs are started **async and polled**, not `run-sync` — a few hundred posts
  exceeds Apify's 60-second sync limit.
- Requests **6× the target count** by default, because filtering is lossy:
  drop non-reels → drop posts outside the window → drop posts with no view count.
- Field names differ between Instagram actors, so every item is normalized across
  known spellings (`videoPlayCount` / `playsCount` / `videoViewCount`;
  `timestamp` / `takenAtTimestamp`).
- Reel detection reads **only actor-provided fields**, never a URL the script
  derived — otherwise every post looks like a reel.
- `--all` runs sources **sequentially** (parallel multiplies Apify spend and makes
  failures hard to attribute); one failure logs and the rest continue.
- `APIFY_API_BASE` env var overrides the API host, for testing against a stub.

### `scripts/analyze-reels.mjs` (325 lines)

Reads the scraper output, sends it to Claude, writes a marketing brief.

```bash
export ANTHROPIC_API_KEY=...
npm run analyze:reels
node scripts/analyze-reels.mjs --audience "solo founders" --offer 'a $47 playbook'
```

Outputs `reels_analysis.json` (structured) and `reels_analysis.md` (readable):
hook patterns, content angles, CTA placement, format notes, engagement outliers,
specific reels to film next, what to avoid — each pattern cited to reel ranks.

The Claude call specifically:

- Model `claude-opus-5`, `thinking: {type: "adaptive"}`, `output_config.effort`
  (default `high`, settable via `--effort`)
- **Structured outputs** — `output_config.format` with a closed JSON schema
  (`additionalProperties: false`, all fields required)
- **Server-side refusal fallback** — `fallbacks: "default"` with beta header
  `server-side-fallback-2026-07-01`
- `stop_reason === "refusal"` checked before reading `content`
- Engagement rate `(likes + comments) / views` computed **in the script**, not by
  the model
- A `countTokens` pre-flight prints estimated input cost first
- Uses `@anthropic-ai/sdk` (added to root `dependencies`), not raw `fetch`
- `ANTHROPIC_BASE_URL` can point at a stub for testing

### `tracked-sources.json`

The watch list `--all` reads. Currently two entries:

```json
{ "sources": [
  { "type": "hashtag",  "value": "aitools",       "enabled": true },
  { "type": "username", "value": "randyandelena", "enabled": true }
] }
```

`type` picks the actor. `enabled: false` pauses without deleting. Output goes to
`reels_data.tag_aitools.json` / `reels_data.user_randyandelena.json`.

---

## 3. IMPORTANT — what has and hasn't actually run

This matters more than anything else in this document.

**Never executed against live APIs.** Neither script has produced real output.
Two reasons, both environmental:

1. The dev environment's network policy **blocks `api.apify.com`** (403 at the
   proxy). Also blocks `apify.com` and `docs.apify.com`.
2. No `APIFY_TOKEN` and no `ANTHROPIC_API_KEY` were available in that environment.
   (`api.anthropic.com` itself is reachable — returns 401, not blocked.)

**What was verified:** both scripts were tested end-to-end against local stub HTTP
servers. Confirmed working: run/poll/paginate flow, date-window filtering,
non-reel exclusion, alternate view-count field names, view sorting, `--all`
multi-source mode with correct per-source actor, markdown report rendering, and
the error branches (missing file, refusal, malformed JSON, bad credentials). The
outgoing Anthropic request was inspected on the wire and carries the intended
shape.

**What is unverified:** whether Apify's actors accept the exact input objects
built, and whether the real Anthropic API accepts the exact request. Both are
plausible but unproven. First real run should use `--dry-run` first.

To actually run these: clone the branch on a machine with normal internet, set
`APIFY_TOKEN` and `ANTHROPIC_API_KEY`, `npm install`, then
`npm run scrape:reels -- --all` followed by `npm run analyze:reels`.

---

## 4. Existing Anthropic integrations (pre-existing, untouched)

Both call the Messages API with **raw `fetch`** (not the SDK) and use
`claude-sonnet-4-6`:

- `api/close.js:146` — DM Closer. System prompt in `CLOSE_SYS` constant. Has a
  domain allowlist (`ALLOWED` array), 60-message cap, `max_tokens: 1500`.
- `viral-flipper/api/flip.js:83` — script flip. `max_tokens: 2500`.

These were **not** modernized. Doing so (→ `claude-opus-5`, adaptive thinking,
SDK instead of raw fetch) is an open option, not done.

`viral-flipper/api/extract.js` uses Apify for scraping plus Groq or OpenAI
Whisper for transcription — that's where the existing Apify patterns live.

### Environment variables across the project

| Var | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | DM Closer, Viral Flipper flip, analyze-reels |
| `APIFY_TOKEN` | Viral Flipper extract, scrape-reels |
| `GROQ_API_KEY` | Viral Flipper transcription (free tier — preferred) |
| `OPENAI_API_KEY` | Viral Flipper transcription (paid fallback, optional) |

---

## 5. Competitor research finding: @randyandelena

Pulled live via a TokScript MCP tool (not Apify) — profile + last 50 reels,
2026-04-24 → 2026-09-04. This is **real data**, unlike the scripts above.

**Account:** 87,632 followers, verified, following 26, 101 posts. Bio positions as
*money transparency | travel | career*, San Diego, `stan.store` link. Median reel
49,636 views; mean 67,855.

**Structure:** power-law. Top 5 reels = **31% of all views** across 50 posts.

**Key finding — the breakouts are not money content:**

| Views | vs median | Comments | Topic |
|---|---|---|---|
| 323,320 | 6.5× | 123 | "I didn't get into medical school and it saved me from a life I didn't want" |
| 249,972 | 5.0× | 4,363 | "What does a scientist actually do?" |
| 172,871 | 3.5× | 102 | Content creation money breakdown |
| 149,780 | 3.0× | 53 | "How much would we save if we don't have fun" |
| 149,701 | 3.0× | 49 | Belgium shopping tour *with prices* |
| 131,962 | 2.7× | 302 | "Having kids is expensive… we won't be having any" |

Money/finance is 32 of 50 reels but medians only 53,381 — it's the floor, not the
ceiling. The two monsters are personal-identity reels. The scientist reel has a
1.75% comment rate and 6.1% engagement, ~3× anything else.

**Mechanics identified:**

1. Recurring series as base — "How we split our finances in [month]", 5 instances, ~57k median
2. Contrarian takes on money taboos (no kids, homeownership not worth it, Gen Z won't work)
3. Specific numbers as hook — "$720k condo, $40k down", "$7,000/year", never "save money"
4. Cadence: one reel every 2.7 days, sustained 4.5 months, no gaps

**Monetization tell:** sponsored posts *underperform* — 38,594 median vs 50,936
organic (−24%). Two exceptions, both comment-gated AI-app builds ("comment BLINK
/ comment build and I'll send you the link"): 116k and 69k views with **1,581 and
632 comments**. The comment-gate turns an ad into the highest-comment content on
the page and builds a DM list — directly relevant to DM Closer.

**Limits of this analysis:** captions and stats only, **no transcripts** — so
spoken hooks, pacing and on-screen text are unknown, and that's likely where much
of the answer lives. Only 133 days of history, so no follower-growth curve — this
says which content outperformed, not when or why the account first inflected.

---

## 6. Open threads

1. **Transcripts for @randyandelena** — TokScript can pull them
   (`submit_transcript_job`). Would upgrade the analysis above from "what topics
   worked" to "what hooks worked". Not done.
2. **First real run of the scripts** — see §3. Needs a machine with Apify access.
3. **`aipro-academy.com` lesson** — user asked to install a system from
   `aipro-academy.com/course-section?module=automation-system&lesson=2`. Domain is
   **blocked by the same network policy** and appears login-gated. Never seen; no
   idea what it contains. Blocked pending the user pasting the lesson content.
4. **Modernizing the two existing Anthropic call sites** — see §4. Not started.
5. **No tests, no linter, no CI** in this repo at all.

---

## 7. Conventions

- Plain JS, ESM, no TypeScript. Don't introduce TS.
- Serverless functions are plain Vercel handlers `(req, res)`.
- Keys are server-side only and never reach the browser — that's the entire point
  of DM Closer's architecture. Preserve it.
- `node_modules` and `dist` are gitignored at root (added this session; the root
  previously had no `.gitignore`).
- Generated data files (`reels_data*.json`, `reels_analysis.*`) are **not**
  gitignored, so results can be committed if wanted.
