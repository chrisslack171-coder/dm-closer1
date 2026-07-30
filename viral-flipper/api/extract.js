// /api/extract.js — Vercel serverless function
// =============================================================================
// Takes one Instagram post/reel URL and returns:
//   { username, caption, videoUrl, transcript, playCount }
//
// Pipeline (all server-side, keys never reach the browser):
//   1. Apify Instagram Scraper  -> video file URL + caption + owner + stats
//   2. OpenAI Whisper           -> transcript of the spoken audio
//
// SETUP (Vercel -> Project -> Settings -> Environment Variables):
//   APIFY_TOKEN     — from console.apify.com (Instagram Scraper actor, pay-per-result)
//   OPENAI_API_KEY  — used ONLY for Whisper transcription
// =============================================================================

const ALLOWED = [
  "thedigitalcloser",
  "netlify.app",
  "vercel.app",
  "stan.store",
  "localhost",
  "127.0.0.1",
];

function originAllowed(req) {
  const ref = req.headers.referer || req.headers.origin || "";
  if (!ref) return false;
  try {
    const host = new URL(ref).hostname;
    return ALLOWED.some((d) => host === d || host.endsWith("." + d) || host.includes(d));
  } catch {
    return false;
  }
}

function isInstagramUrl(u) {
  try {
    const h = new URL(u).hostname;
    return h === "instagram.com" || h.endsWith(".instagram.com");
  } catch {
    return false;
  }
}

async function scrapePost(url, token) {
  const endpoint =
    "https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items" +
    "?token=" + encodeURIComponent(token) + "&timeout=55";
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: [url],
      resultsType: "posts",
      resultsLimit: 1,
      addParentData: false,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("Apify error:", r.status, t.slice(0, 300));
    throw new Error("Couldn't fetch that post (scraper " + r.status + ")");
  }
  const items = await r.json();
  const post = Array.isArray(items) ? items[0] : null;
  if (!post) throw new Error("No data returned for that URL — is the post public?");
  const videoUrl = post.videoUrl || (post.videoUrls && post.videoUrls[0]) || null;
  if (!videoUrl) throw new Error("That post has no video (image posts can't be transcribed)");
  return {
    username: post.ownerUsername || "",
    caption: post.caption || "",
    videoUrl,
    playCount: post.videoPlayCount || post.videoViewCount || null,
    likes: post.likesCount || null,
  };
}

async function transcribe(videoUrl, key) {
  const vr = await fetch(videoUrl);
  if (!vr.ok) throw new Error("Couldn't download the video file (" + vr.status + ")");
  const buf = await vr.arrayBuffer();
  // Whisper's upload cap is 25MB; nearly all reels fit. Guard so we fail clean.
  if (buf.byteLength > 24 * 1024 * 1024) {
    throw new Error("Video is too large to transcribe (over 24MB)");
  }
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: "video/mp4" }), "reel.mp4");
  fd.append("model", "whisper-1");
  const tr = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key },
    body: fd,
  });
  if (!tr.ok) {
    const t = await tr.text();
    console.error("Whisper error:", tr.status, t.slice(0, 300));
    throw new Error("Transcription failed (" + tr.status + ")");
  }
  const data = await tr.json();
  return (data.text || "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!originAllowed(req)) return res.status(403).json({ error: "Forbidden" });

  const apifyToken = process.env.APIFY_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!apifyToken || !openaiKey) {
    return res.status(500).json({ error: "Server not configured (APIFY_TOKEN / OPENAI_API_KEY)" });
  }

  const { url } = req.body || {};
  if (typeof url !== "string" || url.length > 500 || !isInstagramUrl(url)) {
    return res.status(400).json({ error: "Send a valid instagram.com post/reel URL" });
  }

  try {
    const post = await scrapePost(url, apifyToken);
    const transcript = await transcribe(post.videoUrl, openaiKey);
    if (!transcript) throw new Error("No speech detected in this video");
    return res.status(200).json({
      username: post.username,
      caption: post.caption,
      videoUrl: post.videoUrl,
      playCount: post.playCount,
      likes: post.likes,
      transcript,
    });
  } catch (e) {
    console.error("extract handler error:", e);
    return res.status(502).json({ error: e.message || "Extraction failed" });
  }
}
