// /api/closer.js — Vercel serverless function
// =============================================================================
// THIS FILE STAYS ON THE SERVER. The $5K Closer methodology lives here and is
// NEVER sent to a buyer's browser. The frontend only ever receives the AI's
// response, never these instructions.
//
// SETUP (one time):
//   1. Vercel → Project → Settings → Environment Variables → add ANTHROPIC_API_KEY
//   2. (Optional) add ACCESS_CODE to gate the tool to paying buyers. Leave it
//      unset while testing and the gate is off.
//   3. Edit the ALLOWED array to your real domain(s) before launch.
// =============================================================================

const SYS = `You are the engine inside "The $5K Closer — Interactive Playbook" by Chris Slack (Golden Door Award winner, 1,032 doors closed). The buyer owns the playbook; you walk them through it and do the heavy lifting at each step. You speak in Chris's voice: calm, low, direct, in control. A closer, not a cheerleader. No hype, no fluff, no corporate filler. Short punchy sentences. You serve, you don't chase.

THE METHODOLOGY (this governs everything you produce):
- People don't buy information. They buy a clear transformation they believe they can actually achieve. Sell the relief, not the speed sheet.
- The One-Sentence Test: "This helps ____ go from ____ to ____." If it isn't one clean line, a buyer can't hold it, and a confused buyer never buys.
- Obvious-to-you is gold-to-them. The product is already inside what they know: the questions people ask them for free, the thing they figured out the hard way, the thing they do faster than most, the transformation they actually lived. Lived proof beats borrowed theory.
- Demand comes first, topic second. Three checks: (1) do people complain about this problem out loud? (2) are they already spending money to solve it? (3) can this person speak to it with credibility? No spending, no market.
- Positioning = problem + promise. The product is never "a guide about X" — it's the fastest way to solve one specific painful thing. Name the problem on the cover, promise the transformation on page one.
- Price like a closer: don't default cheap — too cheap reads as low value. Anchor first (what the problem costs them, what a coach would charge), then show the price.
- $5K is doors math: small repeatable daily targets, not a lottery ticket. Set a floor, hit it daily, let the average work.
- The First Line: "Hey — I just wanted to let you know..." then something genuinely FOR THEM — their benefit, their problem, never the product. It lowers the guard, points at them not you, earns the next sentence. Salesy = pushing what YOU want before showing something THEY want.
- 7-Day Launch: done and selling beats perfect and unreleased. Knowledge with no deadline is a hobby.

HARD RULES:
- NEVER make income claims or guarantees. $5K is a target the buyer works toward, never a promise. Frame everything as "if X then Y" effort math, never "you will make."
- Everything you generate must be specific to THIS buyer's inputs — mirror their words. Generic advice is a failure.
- Keep outputs tight. A buyer should read any output in under 60 seconds and know exactly what to do next.
- Respond ONLY with valid JSON. No markdown fences, no preamble, no trailing commentary. Exactly the shape requested for the step.`;

// Domains allowed to call this endpoint. Add your real hub/Stan/Vercel domains.
// Keep localhost while testing; tighten before launch.
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

function s(v, max = 600) {
  return String(v == null ? "" : v).slice(0, max).trim();
}

// Each step's user prompt is built server-side so the frontend stays dumb.
function buildPrompt(step, p) {
  const promise = s(p.promise);
  const idea = p.idea || {};
  const ideaLine = idea.title
    ? `Their chosen product: "${s(idea.title)}" (${s(idea.format, 100)}) — transformation: ${s(idea.transformation)}`
    : "";

  if (step === "promise") {
    return `STEP 1 — THE SHIFT. The buyer is finding their one-sentence promise.

What they know / can do: ${s(p.know)}
Who they've helped (or could help): ${s(p.helped)}
The result they can genuinely get someone: ${s(p.result)}

Run the One-Sentence Test for them. Write 3 sharp versions of "This helps ____ go from ____ to ____" using their exact situation — each targeting a slightly different angle (audience, pain, or outcome). Every version must sell a transformation, not information. Then pick the strongest and say why in one closer-voice line.

JSON shape: {"options":[{"sentence":"...","angle":"2-4 word label"},{...},{...}],"pick":0,"why":"one line"}`;
  }

  if (step === "mine") {
    return `STEP 2 — MINE YOUR KNOWLEDGE. Their locked promise: "${promise}"

Their four answers:
- What people already ask them for help with: ${s(p.ask)}
- What they figured out the hard way: ${s(p.hardway)}
- What they do faster/better than most: ${s(p.faster)}
- The transformation they actually lived: ${s(p.lived)}

Turn this into 3 meaningfully different digital product ideas they could build in days, not months (simple guide, template pack, checklist system, mini playbook — buildable in Canva or from a rebranded PLR base). For each: a working title that names a problem, the format, the one transformation it delivers, and one line on why it fits what they mined. Rank them — first is your recommendation. Remember: obvious-to-them is gold to their buyer.

JSON shape: {"ideas":[{"title":"...","format":"...","transformation":"...","why":"..."},{...},{...}],"why_first":"one closer-voice line on why idea 1 wins"}`;
  }

  if (step === "position") {
    return `STEP 3 — POSITION IT AROUND A REAL PROBLEM. Their promise: "${promise}"
${ideaLine}

1) Run the three demand checks honestly against this product. For each give a verdict "PASS", "LEAN" (probably fine, sharpen it), or "RISK" (weak — here's the fix), plus one specific note. The checks: people complain about this out loud / people already spend money on this / this buyer has credibility to speak to it. Judge from what you know of the niche; be straight, not flattering.
2) Then position it: 3 cover-title options that NAME THE PROBLEM (punchy, no colons required, no generic "guide to"), one cover subtitle line, and the page-one promise line (the transformation, stated like a closer).

JSON shape: {"checks":[{"check":"Complain out loud","verdict":"PASS|LEAN|RISK","note":"..."},{"check":"Already spending","verdict":"...","note":"..."},{"check":"Credibility","verdict":"...","note":"..."}],"titles":["...","...","..."],"subtitle":"...","page_one_promise":"..."}`;
  }

  if (step === "firstline") {
    return `STEP 5 — THE FIRST LINE. Their promise: "${promise}"
${ideaLine}
Their price: $${s(p.price, 10)}

Write their openers using Chris's line — every one starts with "Hey — I just wanted to let you know" (or the natural "I just wanted to let you know" variant) and then leads with something genuinely FOR the reader: their benefit, their problem, a free give. Never the product first. Never salesy.

Produce:
- 3 DM openers (different plays: free-value give / problem call-out / warm "noticed you" angle). Each ready to send verbatim, 1-3 sentences, ends in a soft question.
- 2 content hooks (first line of a post/video using the same disarm-then-give energy).
- 1 line of coaching in Chris's voice on how to use them without sounding desperate.

JSON shape: {"dms":[{"play":"2-3 word label","text":"..."},{...},{...}],"hooks":["...","..."],"coach":"..."}`;
  }

  if (step === "launch") {
    return `STEP 6 — THE 7-DAY LAUNCH. Assemble their personalized launch week.

Their promise: "${promise}"
${ideaLine}
Their price: $${s(p.price, 10)} — that's ~${s(p.salesNeeded, 10)} sales to $5K, about ${s(p.perDay, 20)} a day over a month.
Their positioning title: ${s(p.title)}
Their best first line: ${s(p.firstLine)}

Write THEIR 7-day launch plan — each day one concrete, finishable task using their actual product, title, price, and first line (mirror the playbook's week: Day 1 lock the promise → Day 2 outline → Day 3 build in Canva or rebrand PLR → Day 4 package with the problem-naming title → Day 5 store setup on Stan/Beacons with anchored pricing → Day 6 first content post → Day 7 DMs + ask for the sale). Personalize every task with their specifics — no generic filler. Then give them their daily floor (the one non-negotiable daily action after launch week) and one closing send-off in Chris's voice (short, no income promises — reps and doors energy).

JSON shape: {"days":[{"day":1,"title":"3-5 words","task":"1-2 sentences, specific to them"},... 7 items],"floor":"one line","sendoff":"1-2 lines"}`;
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!originAllowed(req)) return res.status(403).json({ error: "Forbidden" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "Server not configured" });

  const { step, payload, code } = req.body || {};

  // Optional buyer gate: set ACCESS_CODE in Vercel env to require a code.
  const gate = process.env.ACCESS_CODE;
  if (gate && s(code, 100) !== gate) {
    return res.status(401).json({ error: "Access code required" });
  }

  if (typeof step !== "string" || typeof payload !== "object" || payload == null) {
    return res.status(400).json({ error: "Invalid request" });
  }
  const prompt = buildPrompt(step, payload);
  if (!prompt) return res.status(400).json({ error: "Unknown step" });

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
        system: SYS, // <-- injected here, server-side only
        messages: [{ role: "user", content: prompt }],
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
    console.error("closer handler error:", e);
    return res.status(500).json({ error: "Request failed" });
  }
}
