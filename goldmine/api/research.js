// /api/research.js — starts and monitors Apify scrapes (Reddit + YouTube).
//
// Actions (POST body {action, ...}):
//   start  {plan}                     -> kicks off both actor runs, returns run ids
//   status {reddit, youtube}          -> per-run status (READY/RUNNING/SUCCEEDED/FAILED)
//   fetch  {redditDs, youtubeDs}      -> trimmed dataset items ready for analysis
//
// SETUP: add APIFY_TOKEN in Vercel env (apify.com -> Settings -> Integrations).
// The actor ids below are the Apify Store defaults; if you swap actors, update
// the input builders to match the new actor's input schema.

import { originAllowed, gateBlocked, clip } from "./_utils.js";

const REDDIT_ACTOR = process.env.REDDIT_ACTOR || "trudax~reddit-scraper-lite";
const YOUTUBE_ACTOR = process.env.YOUTUBE_ACTOR || "streamers~youtube-scraper";

// Cost guards — keep runs cheap (~$0.10-0.40 total per user run).
const REDDIT_MAX_ITEMS = 60;
const YOUTUBE_MAX_ITEMS = 25;

const APIFY = "https://api.apify.com/v2";

function redditInput(plan) {
  const searches = []
    .concat((plan.subreddits || []).slice(0, 5).map((s) => "r/" + String(s).replace(/^r\//, "")))
    .concat((plan.reddit_searches || []).slice(0, 3));
  return {
    searches,
    searchPosts: true,
    searchComments: true,
    searchCommunities: false,
    searchUsers: false,
    sort: "top",
    time: "year",
    includeNSFW: false,
    maxItems: REDDIT_MAX_ITEMS,
    maxPostCount: 40,
    maxComments: 20,
    proxy: { useApifyProxy: true },
  };
}

function youtubeInput(plan) {
  return {
    searchQueries: (plan.youtube_queries || []).slice(0, 3),
    maxResults: YOUTUBE_MAX_ITEMS,
    maxResultsShorts: 10,
    maxResultStreams: 0,
    proxy: { useApifyProxy: true },
  };
}

async function startRun(token, actor, input) {
  const r = await fetch(`${APIFY}/acts/${actor}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("Apify start error:", actor, r.status, t.slice(0, 300));
    throw new Error(`Couldn't start ${actor} (${r.status})`);
  }
  const data = await r.json();
  return { runId: data.data.id, datasetId: data.data.defaultDatasetId };
}

async function runStatus(token, runId) {
  const r = await fetch(`${APIFY}/actor-runs/${runId}?token=${token}`);
  if (!r.ok) throw new Error("status " + r.status);
  const data = await r.json();
  return data.data.status; // READY | RUNNING | SUCCEEDED | FAILED | ABORTED | TIMED-OUT
}

async function datasetItems(token, datasetId, limit) {
  const r = await fetch(`${APIFY}/datasets/${datasetId}/items?token=${token}&limit=${limit}&clean=true`);
  if (!r.ok) throw new Error("dataset " + r.status);
  return r.json();
}

// Trim scraped items down to the fields the analyst needs — keeps the
// Claude prompt small no matter what the actors return.
function trimReddit(items) {
  return (items || [])
    .map((it) => ({
      kind: it.dataType || (it.body ? "comment" : "post"),
      title: clip(it.title, 200),
      text: clip(it.body || it.text || it.selftext, 500),
      sub: clip(it.parsedCommunityName || it.communityName || it.subreddit, 60),
      score: Number(it.upVotes ?? it.score ?? 0) || 0,
      comments: Number(it.numberOfComments ?? it.numComments ?? 0) || 0,
    }))
    .filter((it) => it.title || it.text)
    .slice(0, REDDIT_MAX_ITEMS);
}

function trimYoutube(items) {
  return (items || [])
    .map((it) => ({
      title: clip(it.title, 200),
      channel: clip(it.channelName || it.channelTitle, 80),
      views: Number(it.viewCount ?? it.views ?? 0) || 0,
      likes: Number(it.likes ?? it.likeCount ?? 0) || 0,
      date: clip(it.date || it.publishedAt, 30),
      desc: clip(it.text || it.description, 300),
    }))
    .filter((it) => it.title)
    .slice(0, YOUTUBE_MAX_ITEMS);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!originAllowed(req)) return res.status(403).json({ error: "Forbidden" });
  if (gateBlocked(req)) return res.status(401).json({ error: "Access code required" });

  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(501).json({ error: "APIFY_TOKEN not set on the server" });

  const { action } = req.body || {};

  try {
    if (action === "start") {
      const plan = req.body.plan;
      if (!plan || typeof plan !== "object") return res.status(400).json({ error: "Missing plan" });
      const [reddit, youtube] = await Promise.all([
        startRun(token, REDDIT_ACTOR, redditInput(plan)),
        startRun(token, YOUTUBE_ACTOR, youtubeInput(plan)),
      ]);
      return res.status(200).json({ reddit, youtube });
    }

    if (action === "status") {
      const { reddit, youtube } = req.body;
      if (!reddit || !youtube) return res.status(400).json({ error: "Missing run ids" });
      const [r, y] = await Promise.all([runStatus(token, reddit), runStatus(token, youtube)]);
      return res.status(200).json({ reddit: r, youtube: y });
    }

    if (action === "fetch") {
      const { redditDs, youtubeDs } = req.body;
      if (!redditDs || !youtubeDs) return res.status(400).json({ error: "Missing dataset ids" });
      const [r, y] = await Promise.all([
        datasetItems(token, redditDs, REDDIT_MAX_ITEMS),
        datasetItems(token, youtubeDs, YOUTUBE_MAX_ITEMS),
      ]);
      return res.status(200).json({ reddit: trimReddit(r), youtube: trimYoutube(y) });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("research error:", e);
    return res.status(502).json({ error: e.message || "Research failed" });
  }
}
