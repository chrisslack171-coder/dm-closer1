// /api/extract.js — Vercel serverless function
// =============================================================================
// Takes ONE video URL — Instagram, TikTok, YouTube (Shorts), or a direct
// .mp4 link — and returns:
//   { platform, username, caption, videoUrl, coverUrl, playCount, likes, transcript }
//
// Pipeline (all server-side, keys never reach the browser):
//   Instagram -> Apify Instagram Scraper -> video file -> OpenAI Whisper
//   TikTok    -> Apify TikTok Scraper -> built-in subtitles (free) or Whisper
//   YouTube   -> Apify YouTube Transcript Scraper (captions, no Whisper needed)
//   .mp4 link -> straight to Whisper
//
// SETUP (Vercel -> Project -> Settings -> Environment Variables):
//   APIFY_TOKEN     — console.apify.com (pay-per-result actors)
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

function detectPlatform(u) {
  try {
    const h = new URL(u).hostname.replace(/^www\./, "");
    if (h === "instagram.com" || h.endsWith(".instagram.com")) return "instagram";
    if (h === "tiktok.com" || h.endsWith(".tiktok.com")) return "tiktok";
    if (h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be") return "youtube";
    if (/\.(mp4|mov|m4v|webm)(\?|$)/i.test(u)) return "file";
    return null;
  } catch {
    return null;
  }
}

async function apifyRun(actor, input, token) {
  const endpoint =
    "https://api.apify.com/v2/acts/" + actor + "/run-sync-get-dataset-items" +
    "?token=" + encodeURIComponent(token) + "&timeout=55";
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("Apify error (" + actor + "):", r.status, t.slice(0, 300));
    throw new Error("Couldn't fetch that post (scraper " + r.status + ")");
  }
  const items = await r.json();
  if (!Array.isArray(items) || !items.length) {
    throw new Error("No data returned — is the post public?");
  }
  return items;
}

// WEBVTT / SRT -> plain text (used for TikTok's built-in subtitles)
function vttToText(vtt) {
  const out = [];
  for (const raw of String(vtt).split("\n")) {
    const line = raw.trim();
    if (!line || line === "WEBVTT" || /^\d+$/.test(line)) continue;
    if (/-->/.test(line) || /^(Kind|Language|NOTE|STYLE)[:\s]/i.test(line)) continue;
    const clean = line.replace(/<[^>]+>/g, "").trim();
    if (clean && out[out.length - 1] !== clean) out.push(clean);
  }
  return out.join(" ").trim();
}

async function transcribeWhisper(videoUrl, key) {
  const vr = await fetch(videoUrl);
  if (!vr.ok) throw new Error("Couldn't download the video file (" + vr.status + ")");
  const buf = await vr.arrayBuffer();
  // Whisper's upload cap is 25MB; nearly all short-form videos fit.
  if (buf.byteLength > 24 * 1024 * 1024) {
    throw new Error("Video is too large to transcribe (over 24MB)");
  }
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: "video/mp4" }), "clip.mp4");
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

async function extractInstagram(url, apifyToken) {
  const items = await apifyRun("apify~instagram-scraper", {
    directUrls: [url],
    resultsType: "posts",
    resultsLimit: 1,
    addParentData: false,
  }, apifyToken);
  const post = items[0];
  const videoUrl = post.videoUrl || (post.videoUrls && post.videoUrls[0]) || null;
  if (!videoUrl) throw new Error("That post has no video (image posts can't be transcribed)");
  return {
    username: post.ownerUsername || "",
    caption: post.caption || "",
    videoUrl,
    coverUrl: post.displayUrl || null,
    playCount: post.videoPlayCount || post.videoViewCount || null,
    likes: post.likesCount || null,
    transcript: null, // Whisper below
  };
}

async function extractTikTok(url, apifyToken) {
  const items = await apifyRun("clockworks~tiktok-scraper", {
    postURLs: [url],
    resultsPerPage: 1,
  }, apifyToken);
  const it = items[0];
  const meta = it.videoMeta || {};
  let transcript = null;
  // TikTok bakes subtitles into most videos — free and exact, no Whisper needed.
  const subs = meta.subtitleLinks || [];
  const sub = subs.find((s) => /^en/i.test(s.language || "")) || subs[0];
  if (sub && sub.downloadLink) {
    try {
      const sr = await fetch(sub.downloadLink);
      if (sr.ok) transcript = vttToText(await sr.text()) || null;
    } catch (e) {
      console.error("TikTok subtitle fetch failed:", e.message);
    }
  }
  return {
    username: (it.authorMeta && it.authorMeta.name) || "",
    caption: it.text || "",
    videoUrl: meta.downloadAddr || (it.mediaUrls && it.mediaUrls[0]) || null,
    coverUrl: meta.coverUrl || null,
    playCount: it.playCount || null,
    likes: it.diggCount || null,
    transcript,
  };
}

async function extractYouTube(url, apifyToken) {
  const items = await apifyRun("pintostudio~youtube-transcript-scraper", {
    videoUrl: url,
  }, apifyToken);
  // Defensive: actor returns caption segments; join every `text` field we find.
  const parts = [];
  const walk = (v) => {
    if (!v) return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === "object") {
      if (typeof v.text === "string") parts.push(v.text);
      else Object.values(v).forEach(walk);
    }
  };
  walk(items);
  const transcript = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!transcript) throw new Error("No captions found on that YouTube video");
  const idMatch = url.match(/(?:shorts\/|watch\?v=|youtu\.be\/)([\w-]{6,})/);
  return {
    username: "",
    caption: "",
    videoUrl: null,
    coverUrl: idMatch ? "https://i.ytimg.com/vi/" + idMatch[1] + "/hqdefault.jpg" : null,
    playCount: null,
    likes: null,
    transcript,
  };
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
  if (typeof url !== "string" || url.length > 500) {
    return res.status(400).json({ error: "Invalid URL" });
  }
  const platform = detectPlatform(url);
  if (!platform) {
    return res.status(400).json({ error: "Paste an Instagram, TikTok, YouTube, or direct video URL" });
  }

  try {
    let post;
    if (platform === "instagram") post = await extractInstagram(url, apifyToken);
    else if (platform === "tiktok") post = await extractTikTok(url, apifyToken);
    else if (platform === "youtube") post = await extractYouTube(url, apifyToken);
    else post = { username: "", caption: "", videoUrl: url, coverUrl: null, playCount: null, likes: null, transcript: null };

    let transcript = post.transcript;
    if (!transcript) {
      if (!post.videoUrl) throw new Error("Couldn't get a downloadable video for that post");
      transcript = await transcribeWhisper(post.videoUrl, openaiKey);
    }
    if (!transcript) throw new Error("No speech detected in this video");

    return res.status(200).json({
      platform,
      username: post.username,
      caption: post.caption,
      videoUrl: post.videoUrl,
      coverUrl: post.coverUrl,
      playCount: post.playCount,
      likes: post.likes,
      transcript,
    });
  } catch (e) {
    console.error("extract handler error:", e);
    return res.status(502).json({ error: e.message || "Extraction failed" });
  }
}
