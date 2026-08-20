#!/usr/bin/env node
// =============================================================================
// scrape-reels.mjs — Apify → Instagram reels for a hashtag, ranked by views
//
// Runs an Apify Instagram scraper actor, keeps only reels posted in the last
// N days, sorts them by view count and writes the top N to a JSON file.
//
// Usage:
//   APIFY_TOKEN=apify_api_xxx node scripts/scrape-reels.mjs
//   ... --hashtag aitools --days 30 --top 50 --out reels_data.json
//
// The token comes from APIFY_TOKEN (console.apify.com → Settings → API tokens)
// or --token. Nothing is written until the scrape succeeds.
//
// Actor note: Apify's "Instagram Reel Scraper" (apify/instagram-reel-scraper)
// takes USERNAMES, not hashtags — it lists an account's reels. Hashtag search
// lives in apify/instagram-hashtag-scraper (the default here) and in the
// general apify/instagram-scraper. All three are supported; pick with --actor.
// =============================================================================

import { writeFile } from "node:fs/promises";

const API = process.env.APIFY_API_BASE || "https://api.apify.com/v2";

// ---------------------------------------------------------------- args ------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq !== -1) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`
scrape-reels.mjs — top Instagram reels for a hashtag, by views

  --hashtag <tag>     hashtag to scrape, no "#"      (default: aitools)
  --username <user>   scrape an account's reels instead of a hashtag
  --days <n>          only keep posts newer than n days   (default: 30)
  --top <n>           how many reels to keep             (default: 50)
  --limit <n>         how many posts to ask Apify for     (default: top x 6)
  --actor <id>        apify~instagram-hashtag-scraper (default)
                      apify~instagram-scraper
                      apify~instagram-reel-scraper   (username mode only)
  --out <file>        output path                  (default: reels_data.json)
  --token <token>     Apify token (else APIFY_TOKEN env var)
  --timeout <sec>     give up polling after n seconds     (default: 900)
  --dry-run           print the actor input and exit, spending no credits
`);
  process.exit(0);
}

const TOKEN = args.token || process.env.APIFY_TOKEN;
const HASHTAG = String(args.hashtag || "aitools").replace(/^#/, "");
const USERNAME = args.username ? String(args.username).replace(/^@/, "") : null;
const DAYS = Number(args.days ?? 30);
const TOP = Number(args.top ?? 50);
const OUT = String(args.out || "reels_data.json");
const TIMEOUT_MS = Number(args.timeout ?? 900) * 1000;
const ACTOR = String(
  args.actor || (USERNAME ? "apify~instagram-reel-scraper" : "apify~instagram-hashtag-scraper")
).replace("/", "~");
// Ask for well more than we keep: most hashtag results fall outside the window
// or aren't reels, so a 1:1 request would leave us short after filtering.
const LIMIT = Number(args.limit ?? TOP * 6);

if (!Number.isFinite(DAYS) || DAYS <= 0) die("--days must be a positive number");
if (!Number.isFinite(TOP) || TOP <= 0) die("--top must be a positive number");

function die(msg) {
  console.error("Error: " + msg);
  process.exit(1);
}

// ------------------------------------------------------------ actor input ---
function buildInput() {
  switch (ACTOR) {
    case "apify~instagram-reel-scraper":
      if (!USERNAME) {
        die(
          "apify~instagram-reel-scraper only takes usernames. Pass --username <account>, " +
            "or drop --actor to use apify~instagram-hashtag-scraper for #" + HASHTAG + "."
        );
      }
      return { username: [USERNAME], resultsLimit: LIMIT };

    case "apify~instagram-hashtag-scraper":
      return { hashtags: [HASHTAG], resultsLimit: LIMIT };

    case "apify~instagram-scraper":
      return USERNAME
        ? { directUrls: ["https://www.instagram.com/" + USERNAME + "/"],
            resultsType: "posts", resultsLimit: LIMIT, addParentData: false }
        : { search: HASHTAG, searchType: "hashtag",
            resultsType: "posts", resultsLimit: LIMIT, addParentData: false };

    default:
      // Unknown actor: best-effort input. Check the actor's own input schema.
      return USERNAME
        ? { username: [USERNAME], resultsLimit: LIMIT }
        : { hashtags: [HASHTAG], resultsLimit: LIMIT };
  }
}

// -------------------------------------------------------------- apify io ----
async function apifyFetch(path, init = {}) {
  const url = API + path + (path.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(TOKEN);
  const r = await fetch(url, init);
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error("Apify " + r.status + " on " + path.split("?")[0] + " — " + body.slice(0, 300));
  }
  return r.json();
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function runActor(input) {
  console.log("Starting " + ACTOR + " ...");
  const started = await apifyFetch("/acts/" + ACTOR + "/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const runId = started.data.id;
  const datasetId = started.data.defaultDatasetId;
  console.log("Run " + runId + " queued — https://console.apify.com/actors/runs/" + runId);

  const deadline = Date.now() + TIMEOUT_MS;
  let status = started.data.status;
  while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
    if (Date.now() > deadline) {
      throw new Error("Run still " + status + " after " + TIMEOUT_MS / 1000 + "s. It keeps going on " +
        "Apify — raise --timeout or pull the dataset later: " + datasetId);
    }
    await sleep(5000);
    const poll = await apifyFetch("/actor-runs/" + runId);
    if (poll.data.status !== status) console.log("  status: " + poll.data.status);
    status = poll.data.status;
  }
  if (status !== "SUCCEEDED") throw new Error("Actor run " + status + " — see the run URL above.");

  return fetchDataset(datasetId);
}

async function fetchDataset(datasetId) {
  const items = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const batch = await apifyFetch(
      "/datasets/" + datasetId + "/items?clean=true&offset=" + offset + "&limit=" + page
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    items.push(...batch);
    if (batch.length < page) break;
  }
  console.log("Fetched " + items.length + " items from dataset " + datasetId);
  return items;
}

// ------------------------------------------------------------ normalizing ---
const firstNumber = (...vals) => {
  for (const v of vals) if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
};

function postedAt(item) {
  if (item.timestamp) {
    const t = Date.parse(item.timestamp);
    if (!Number.isNaN(t)) return t;
  }
  for (const k of ["takenAtTimestamp", "taken_at_timestamp", "createTime", "takenAt"]) {
    const v = item[k];
    if (typeof v === "number" && Number.isFinite(v)) return v > 1e12 ? v : v * 1000;
  }
  return null;
}

// Field names differ between actors and between Instagram's own responses,
// so read every spelling we've seen rather than trusting one shape.
function normalize(item, reel) {
  const shortCode = item.shortCode || item.shortcode || item.code || null;
  const ts = postedAt(item);
  const path = reel ? "/reel/" : "/p/";
  return {
    id: item.id || item.pk || shortCode || null,
    shortCode,
    url: item.url || (shortCode ? "https://www.instagram.com" + path + shortCode + "/" : null),
    username: item.ownerUsername || item.username || item.owner?.username || null,
    caption: item.caption || item.text || "",
    hashtags: item.hashtags || [],
    postedAt: ts ? new Date(ts).toISOString() : null,
    views: firstNumber(item.videoPlayCount, item.playCount, item.playsCount,
                       item.videoViewCount, item.viewCount, item.videoPlays),
    likes: firstNumber(item.likesCount, item.likeCount, item.likes),
    comments: firstNumber(item.commentsCount, item.commentCount, item.comments),
    durationSec: firstNumber(item.videoDuration, item.duration),
    videoUrl: item.videoUrl || item.videoUrls?.[0]?.url || item.videoUrls?.[0] || null,
    thumbnailUrl: item.displayUrl || item.thumbnailUrl || item.coverUrl || null,
    _postedAtMs: ts,
  };
}

// Judge from the actor's own fields only — never from a URL we derived
// ourselves, which would call every post a reel.
function isReel(item) {
  if (item.productType === "clips" || item.product_type === "clips") return true;
  if (typeof item.type === "string" && item.type.toLowerCase() === "video") return true;
  if (item.isVideo === true || item.is_video === true) return true;
  if (typeof item.url === "string" && /\/(reel|reels)\//.test(item.url)) return true;
  return Boolean(item.videoUrl || item.videoUrls?.length);
}

// -------------------------------------------------------------------- main --
async function main() {
  const input = buildInput();

  if (args["dry-run"]) {
    console.log("Actor: " + ACTOR);
    console.log("Input: " + JSON.stringify(input, null, 2));
    console.log("Would keep the top " + TOP + " reels from the last " + DAYS + " days → " + OUT);
    return;
  }
  if (!TOKEN) {
    die("no Apify token. Set APIFY_TOKEN or pass --token (console.apify.com → Settings → API tokens).");
  }

  const raw = await runActor(input);
  if (!raw.length) die("the actor returned no items — is the hashtag/account public and spelled right?");

  const cutoff = Date.now() - DAYS * 24 * 60 * 60 * 1000;
  const reelFlags = raw.map(isReel);
  const normalized = raw.map((item, i) => normalize(item, reelFlags[i]));

  const reels = normalized.filter((_, i) => reelFlags[i]);
  const dated = reels.filter((r) => r._postedAtMs !== null);
  const undated = reels.length - dated.length;
  const inWindow = dated.filter((r) => r._postedAtMs >= cutoff);
  const withViews = inWindow.filter((r) => typeof r.views === "number");

  const top = withViews
    .sort((a, b) => b.views - a.views)
    .slice(0, TOP)
    .map(({ _postedAtMs, ...rest }, i) => ({ rank: i + 1, ...rest }));

  const payload = {
    query: USERNAME ? { username: USERNAME } : { hashtag: "#" + HASHTAG },
    actor: ACTOR,
    scrapedAt: new Date().toISOString(),
    windowDays: DAYS,
    sortedBy: "views",
    counts: {
      scraped: raw.length,
      reels: reels.length,
      undated: undated,
      inWindow: inWindow.length,
      withViewCount: withViews.length,
      returned: top.length,
    },
    reels: top,
  };

  await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(
    "\n" + raw.length + " scraped → " + reels.length + " reels → " + inWindow.length +
    " in the last " + DAYS + " days → wrote top " + top.length + " to " + OUT
  );
  if (undated) console.log("  (" + undated + " reels had no timestamp and were dropped)");
  if (inWindow.length && withViews.length < inWindow.length) {
    console.log("  (" + (inWindow.length - withViews.length) + " had no view count and were dropped)");
  }
  if (top.length < TOP) {
    console.log("  Fewer than " + TOP + " matched — retry with a bigger --limit or a wider --days.");
  }
  for (const r of top.slice(0, 10)) {
    console.log("  " + String(r.rank).padStart(2) + ". " + String(r.views).padStart(9) +
      " views  @" + (r.username || "?") + "  " + (r.url || ""));
  }
}

main().catch((err) => die(err.message));
