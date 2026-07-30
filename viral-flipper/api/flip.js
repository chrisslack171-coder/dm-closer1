// /api/flip.js — Vercel serverless function
// =============================================================================
// Two jobs, one endpoint:
//   FLIP  — competitor transcript + YOUR voice profile -> reverse-engineered
//           blueprint (hook, structure, pacing, tone, CTA, why it worked)
//           + the script rewritten in your voice.
//   REMIX — pass `previousScript` + `instructions` ("make it funnier",
//           "shorten to 30s") -> a new version, same blueprint, same voice.
//
// If the frontend sends a coverUrl, the cover frame is analyzed too (visual
// style, on-screen text) — best-effort, retried without the image on failure.
//
// SETUP: Vercel -> Project -> Settings -> Environment Variables -> ANTHROPIC_API_KEY
// =============================================================================

const FLIP_SYS = `You are a short-form video strategist and script flipper for faceless Instagram/TikTok/YouTube videos.

You receive:
1. A competitor's VIRAL transcript (it went viral — the STRUCTURE is proven). Sometimes also their caption and the video's cover frame.
2. The creator's VOICE PROFILE: who they are, their niche, offer, tone, phrases they use, phrases they'd never use.
3. Optionally, a PREVIOUS FLIP of this script plus REMIX INSTRUCTIONS.

STEP 1 — REVERSE-ENGINEER THE BLUEPRINT. Identify:
- hook_type: the exact hook mechanism (curiosity gap, bold claim, callout, negative hook, list promise, story loop, pattern interrupt...)
- structure: the beats in order, each as a short label + what it does (e.g. "Hook — challenges a common belief")
- tone: delivery energy and register
- pacing: sentence length, rhythm, where it speeds up/slows down
- cta: what action is asked and WHERE it sits
- why_it_worked: 1-2 sentences on the psychological engine of this video
If a cover frame is provided, fold its visual style and any on-screen text into the read.

STEP 2 — FLIP THE SCRIPT:
- KEEP the blueprint: same hook mechanism, beat order, approximate length, pacing, CTA placement.
- REPLACE the substance: claims, examples, niche language, and point of view must come from the creator's voice profile — never from the competitor. Never keep the competitor's name, product, numbers, or personal stories.
- SOUND like the creator: match the voice profile's tone and vocabulary. Write for the EAR — this will be read aloud by a cloned voice. Short sentences. No hashtags, no emojis, no camera directions, no "[pause]" markers.
- If the competitor's claim would be dishonest coming from the creator (income claims, fake credentials), swap in an honest equivalent from the voice profile.

REMIX MODE — when a previous flip + instructions are provided: revise the PREVIOUS script per the instructions. Keep the blueprint and the creator's voice unless the instructions say otherwise. Report the same blueprint.

Respond ONLY as JSON, no markdown:
{
 "title": "<2-5 word working title>",
 "blueprint": {
   "hook_type": "<2-4 words>",
   "structure": ["<beat 1 — what it does>", "<beat 2 — ...>", "..."],
   "tone": "<short>",
   "pacing": "<short>",
   "cta": "<what + where>"
 },
 "why_it_worked": "<1-2 sentences>",
 "script": "<the full flipped script, ready to paste into a voice generator>"
}`;

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

async function callClaude(key, content) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      system: FLIP_SYS,
      messages: [{ role: "user", content }],
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!originAllowed(req)) return res.status(403).json({ error: "Forbidden" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "Server not configured" });

  const { transcript, caption, username, voiceProfile, coverUrl, previousScript, instructions } = req.body || {};
  if (typeof transcript !== "string" || !transcript.trim() || transcript.length > 20000) {
    return res.status(400).json({ error: "Invalid transcript" });
  }
  if (typeof voiceProfile !== "string" || !voiceProfile.trim() || voiceProfile.length > 8000) {
    return res.status(400).json({ error: "Add your voice profile first" });
  }

  let text =
    "COMPETITOR (" + (username || "unknown") + ") VIRAL TRANSCRIPT:\n" +
    transcript.trim() +
    (caption ? "\n\nTHEIR CAPTION (context only):\n" + String(caption).slice(0, 1500) : "") +
    "\n\nMY VOICE PROFILE:\n" + voiceProfile.trim();
  if (typeof previousScript === "string" && previousScript.trim() && typeof instructions === "string" && instructions.trim()) {
    text +=
      "\n\nPREVIOUS FLIP (revise this one):\n" + previousScript.trim().slice(0, 8000) +
      "\n\nREMIX INSTRUCTIONS:\n" + instructions.trim().slice(0, 1000);
  } else {
    text += "\n\nFlip it.";
  }

  // Cover frame analysis is best-effort: try with the image, fall back without.
  const withImage =
    typeof coverUrl === "string" && /^https:\/\//.test(coverUrl)
      ? [{ type: "image", source: { type: "url", url: coverUrl } }, { type: "text", text }]
      : null;

  try {
    let r = withImage ? await callClaude(key, withImage) : await callClaude(key, text);
    if (!r.ok && withImage) r = await callClaude(key, text);

    if (!r.ok) {
      const detail = await r.text();
      console.error("Anthropic error:", r.status, detail);
      if (r.status === 429 || r.status === 529 || r.status >= 500) {
        return res.status(r.status).json({ error: "AI busy (" + r.status + ")" });
      }
      return res.status(502).json({ error: "Upstream error" });
    }

    const data = await r.json();
    const out = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return res.status(200).json({ text: out });
  } catch (e) {
    console.error("flip handler error:", e);
    return res.status(500).json({ error: "Request failed" });
  }
}
