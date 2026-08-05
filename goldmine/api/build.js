// /api/build.js — turns the chosen pain point + trends into a product
// concept and ready-to-post content.

import { originAllowed, gateBlocked, callClaude, clip, VOICE } from "./_utils.js";

const SYS = `${VOICE}

You are the GoldMine builder. The user picked the pain point to build on. Produce:

1. PRODUCT — a digital product they can build in days (simple guide, template pack, checklist system, mini playbook — Canva-buildable). Positioning = problem + promise: title NAMES the problem, promise states the transformation. Include: title, subtitle, format, the one-sentence promise ("This helps ___ go from ___ to ___"), a 6-8 section outline (each section one line, transformation-ordered), and a suggested price with one-line anchor logic (what the problem costs them / what a coach charges).
2. POSTS — 6 ready-to-post pieces of short-form content modeled on the trending patterns provided (not generic): mix of TikTok/Reels scripts (hook line + 60-90 word talking script + one-line CTA) and 1-2 text posts. Every hook leads with the pain in the buyer's own words. CTAs point to the product naturally, never desperate.
3. FIRST LINE — one DM opener starting "Hey — I just wanted to let you know..." that leads with a genuine give related to this pain.

Respond ONLY as JSON:
{"product":{"title":"...","subtitle":"...","format":"...","promise":"...","outline":["..."],"price":47,"anchor":"..."},
 "posts":[{"platform":"TikTok/Reels|Text post","hook":"...","script":"...","cta":"..."}],
 "first_line":"..."}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!originAllowed(req)) return res.status(403).json({ error: "Forbidden" });
  if (gateBlocked(req)) return res.status(401).json({ error: "Access code required" });

  const { plan, pain, trends } = req.body || {};
  if (!plan || !pain || !Array.isArray(trends)) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const prompt = `NICHE: ${clip(plan.niche, 200)}
AUDIENCE: ${clip(plan.audience, 200)}

CHOSEN PAIN POINT: ${clip(pain.pain, 300)}
Heat: ${clip(pain.heat, 5)}/10
Buyers' words: ${JSON.stringify((pain.quotes || []).slice(0, 3))}
What they'd pay to feel: ${clip(pain.instead, 300)}

TRENDING CONTENT PATTERNS:
${JSON.stringify(trends.slice(0, 4))}

Build the product and the posts.`;

  try {
    const out = await callClaude(SYS, prompt, 3500);
    if (out.error) return res.status(out.status).json({ error: out.error });
    return res.status(200).json({ text: out.text });
  } catch (e) {
    console.error("build error:", e);
    return res.status(500).json({ error: "Request failed" });
  }
}
