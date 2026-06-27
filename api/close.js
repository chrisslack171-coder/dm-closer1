// /api/close.js — Vercel serverless function
// =============================================================================
// THIS FILE STAYS ON THE SERVER. Your closing system lives here and is NEVER
// sent to a buyer's browser. The frontend only ever receives the AI's response,
// never these instructions.
//
// SETUP (one time):
//   1. Vercel → Project → Settings → Environment Variables → add ANTHROPIC_API_KEY
//   2. Paste your real closing system into CLOSE_SYS below (between the backticks).
//   3. Edit the ALLOWED array to your real domain(s) before launch.
// =============================================================================

// >>> PASTE YOUR FULL CLOSING SYSTEM BETWEEN THESE BACKTICKS <<<
// (This is where the CLOSE_SYS text from your old front-end file goes.
//  It is safe here — it runs server-side and never ships to the browser.)
const CLOSE_SYS = `PASTE_YOUR_CLOSE_SYS_HERE`;

// Domains allowed to call this endpoint. Add your real hub/Stan/Vercel domains.
// Keep localhost while testing; tighten before launch.
const ALLOWED = [
  "thedigitalcloser",   // matches any domain containing this — adjust to your real domain
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
  if (!CLOSE_SYS || CLOSE_SYS === "PASTE_YOUR_CLOSE_SYS_HERE") {
    return res.status(500).json({ error: "Closing system not installed on server" });
  }

  // The frontend sends the running conversation as `messages` (array of {role, content}).
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Invalid request" });
  }
  // basic sanity caps so the endpoint can't be abused into huge calls
  if (messages.length > 60) return res.status(400).json({ error: "Conversation too long" });
  for (const m of messages) {
    if (!m || typeof m.content !== "string" || m.content.length > 8000) {
      return res.status(400).json({ error: "Invalid message" });
    }
  }

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
        max_tokens: 1500,
        system: CLOSE_SYS,        // <-- injected here, server-side only
        messages,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("Anthropic error:", r.status, detail);
      // Pass through busy/overload so the frontend retry logic still works
      if (r.status === 429 || r.status === 529 || r.status >= 500) {
        return res.status(r.status).json({ error: "AI busy (" + r.status + ")" });
      }
      return res.status(502).json({ error: "Upstream error" });
    }

    const data = await r.json();
    // Return ONLY the model's text. None of CLOSE_SYS is ever in this payload.
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return res.status(200).json({ text });
  } catch (e) {
    console.error("close handler error:", e);
    return res.status(500).json({ error: "Request failed" });
  }
}
