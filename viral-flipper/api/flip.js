// /api/flip.js — Vercel serverless function
// =============================================================================
// Takes a competitor's transcript + YOUR voice profile, returns the script
// rewritten in your voice — same viral structure (hook, beats, pacing, CTA
// placement), your positioning, stories, and phrasing.
//
// SETUP: Vercel -> Project -> Settings -> Environment Variables -> ANTHROPIC_API_KEY
// =============================================================================

const FLIP_SYS = `You are a short-form script flipper for faceless Instagram/TikTok videos.

You receive:
1. A competitor's VIRAL transcript (it went viral — the STRUCTURE is proven).
2. The creator's VOICE PROFILE: who they are, their niche, offer, tone, phrases they use, phrases they'd never use.

Your job — flip the script:
- KEEP the viral skeleton: the hook mechanism (curiosity gap, bold claim, callout, list, story-loop — whatever it is), the beat order, the approximate length and pacing, where the payoff lands, where the CTA sits.
- REPLACE the substance: the claims, examples, niche language, and point of view must come from the creator's voice profile — never from the competitor. Do not keep the competitor's name, product, numbers, or personal stories.
- SOUND like the creator: match the tone and vocabulary in the voice profile. Write for the EAR, not the eye — this will be read aloud by a cloned voice. Short sentences. No hashtags, no emojis, no camera directions, no "[pause]" markers.
- If the competitor's claim would be dishonest coming from the creator (income claims, fake credentials), swap in an honest equivalent from the voice profile.

Respond ONLY as JSON, no markdown:
{
 "title": "<2-5 word working title for this video>",
 "hook_type": "<the hook mechanism you preserved, 2-4 words>",
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!originAllowed(req)) return res.status(403).json({ error: "Forbidden" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "Server not configured" });

  const { transcript, caption, username, voiceProfile } = req.body || {};
  if (typeof transcript !== "string" || !transcript.trim() || transcript.length > 20000) {
    return res.status(400).json({ error: "Invalid transcript" });
  }
  if (typeof voiceProfile !== "string" || !voiceProfile.trim() || voiceProfile.length > 8000) {
    return res.status(400).json({ error: "Add your voice profile first" });
  }

  const user =
    "COMPETITOR (" + (username || "unknown") + ") VIRAL TRANSCRIPT:\n" +
    transcript.trim() +
    (caption ? "\n\nTHEIR CAPTION (context only):\n" + String(caption).slice(0, 1500) : "") +
    "\n\nMY VOICE PROFILE:\n" + voiceProfile.trim() +
    "\n\nFlip it.";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: FLIP_SYS,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("Anthropic error:", r.status, detail);
      if (r.status === 429 || r.status === 529 || r.status >= 500) {
        return res.status(r.status).json({ error: "AI busy (" + r.status + ")" });
      }
      return res.status(502).json({ error: "Upstream error" });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return res.status(200).json({ text });
  } catch (e) {
    console.error("flip handler error:", e);
    return res.status(500).json({ error: "Request failed" });
  }
}
