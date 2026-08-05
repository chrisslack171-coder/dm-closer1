// Shared server-side helpers. The underscore prefix keeps Vercel from
// exposing this file as a route.

export const ALLOWED = [
  "thedigitalcloser",
  "netlify.app",
  "vercel.app",
  "stan.store",
  "localhost",
  "127.0.0.1",
];

export function originAllowed(req) {
  const ref = req.headers.referer || req.headers.origin || "";
  if (!ref) return false;
  try {
    const host = new URL(ref).hostname;
    return ALLOWED.some((d) => host === d || host.endsWith("." + d) || host.includes(d));
  } catch {
    return false;
  }
}

// Optional buyer gate: set ACCESS_CODE in Vercel env to require a code.
export function gateBlocked(req) {
  const gate = process.env.ACCESS_CODE;
  if (!gate) return false;
  const code = String((req.body || {}).code || req.query.code || "").slice(0, 100);
  return code !== gate;
}

export function clip(v, max) {
  return String(v == null ? "" : v).slice(0, max).trim();
}

export async function callClaude(system, prompt, maxTokens = 2500) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: "Server not configured", status: 500 };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) {
    const detail = await r.text();
    console.error("Anthropic error:", r.status, detail);
    if (r.status === 429 || r.status === 529 || r.status >= 500) {
      return { error: "AI busy (" + r.status + ")", status: r.status };
    }
    return { error: "Upstream error", status: 502 };
  }
  const data = await r.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text };
}

// Multi-turn variant for the interview endpoint.
export async function callClaudeChat(system, messages, maxTokens = 1200) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: "Server not configured", status: 500 };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages }),
  });
  if (!r.ok) {
    const detail = await r.text();
    console.error("Anthropic error:", r.status, detail);
    if (r.status === 429 || r.status === 529 || r.status >= 500) {
      return { error: "AI busy (" + r.status + ")", status: r.status };
    }
    return { error: "Upstream error", status: 502 };
  }
  const data = await r.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text };
}

// The methodology voice shared by every GoldMine prompt.
export const VOICE = `You speak in the voice of Chris Slack — Golden Door Award winner, 1,032 doors closed, creator of The $5K Closer. Calm, low, direct, in control. A closer, not a cheerleader. No hype, no fluff. Core beliefs: people don't buy information, they buy a clear transformation they believe they can achieve; demand comes first, topic second — build for problems people already complain about out loud and already spend money trying to fix; obvious-to-you is gold-to-them. NEVER make income claims or guarantees — everything is effort math, never "you will make". Respond ONLY with valid JSON — no markdown fences, no preamble.`;
