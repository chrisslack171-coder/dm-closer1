// /api/analyze.js — turns raw scraped data into the pain point report.

import { originAllowed, gateBlocked, callClaude, clip, VOICE } from "./_utils.js";

const SYS = `${VOICE}

You are the GoldMine analyst. You are handed raw scraped data: Reddit posts/comments (buyers complaining in their own words) and YouTube results (what content is winning in the niche). Your job, in order:

1. PAIN POINTS — find the 4-5 problems people complain about most, ranked by how loud and how frequent. For each: name the pain in plain buyer language, give a heat score 1-10 (frequency x emotional intensity in the data), quote 2-3 SHORT verbatim fragments from the data (buyers' exact words — these are gold, do not paraphrase), and state what the buyer would pay to feel instead.
2. TRENDS — from YouTube (and any Reddit signal), identify 3-4 content patterns that are working: topic + format + why it's pulling views. Be specific ("'$0 to first sale' story breakdowns, 8-15 min, avg 200K views"), not generic ("educational content does well").
3. VERDICT — which single pain to build a product on and why, one closer-voice line. Highest heat + clearest spending signal wins.

If the data is thin or off-niche, say so honestly in the verdict — never invent quotes. Every quote must appear in the provided data.

Respond ONLY as JSON:
{"pains":[{"pain":"...","heat":8,"quotes":["...","..."],"instead":"what they'd pay to feel"}],
 "trends":[{"pattern":"...","evidence":"...","platform":"YouTube|Reddit"}],
 "verdict":"..."}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!originAllowed(req)) return res.status(403).json({ error: "Forbidden" });
  if (gateBlocked(req)) return res.status(401).json({ error: "Access code required" });

  const { plan, reddit, youtube } = req.body || {};
  if (!plan || !Array.isArray(reddit) || !Array.isArray(youtube)) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const prompt = `NICHE: ${clip(plan.niche, 200)}
AUDIENCE: ${clip(plan.audience, 200)}
PAIN HYPOTHESIS: ${clip(plan.pain_hypothesis, 200)}

=== REDDIT DATA (${reddit.length} items) ===
${JSON.stringify(reddit.slice(0, 60))}

=== YOUTUBE DATA (${youtube.length} items) ===
${JSON.stringify(youtube.slice(0, 25))}

Mine it. Pain points, trends, verdict.`;

  try {
    const out = await callClaude(SYS, prompt, 3000);
    if (out.error) return res.status(out.status).json({ error: out.error });
    return res.status(200).json({ text: out.text });
  } catch (e) {
    console.error("analyze error:", e);
    return res.status(500).json({ error: "Request failed" });
  }
}
