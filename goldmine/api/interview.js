// /api/interview.js — the niche interview.
// Claude interviews the user (max 4 questions, one at a time) and, once
// confident, emits a structured research plan the scraper endpoints consume.

import { originAllowed, gateBlocked, callClaudeChat, VOICE } from "./_utils.js";

const SYS = `${VOICE}

You are the GoldMine interviewer. Your job: find the user's niche and the audience whose pain they can serve, in as few questions as possible (max 4, one question per turn). Ask like a closer reads a door — every question earns its place. Probe for: what they know or have lived, who they'd serve, and any hunch about the problem. If their first answer is already rich, don't pad — go straight to the plan.

When you are confident, output the research plan. Choose subreddits that really exist and are active, and search queries a struggling buyer would actually type.

Each turn respond ONLY as JSON, one of:
{"done": false, "question": "<your next question, one line, closer voice>", "why": "<3-6 words on what you're reading for>"}
or
{"done": true,
 "plan": {
   "niche": "<one line>",
   "audience": "<who the buyer is, one line>",
   "pain_hypothesis": "<the problem you expect to find, one line>",
   "subreddits": ["<3-5 real subreddit names, no r/ prefix>"],
   "reddit_searches": ["<2-3 search phrases a hurting buyer would post>"],
   "youtube_queries": ["<2-3 search queries for trending videos in this niche>"]
 },
 "read": "<one closer-voice line: what you saw in their answers>"}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!originAllowed(req)) return res.status(403).json({ error: "Forbidden" });
  if (gateBlocked(req)) return res.status(401).json({ error: "Access code required" });

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
    return res.status(400).json({ error: "Invalid request" });
  }
  for (const m of messages) {
    if (!m || typeof m.content !== "string" || m.content.length > 4000) {
      return res.status(400).json({ error: "Invalid message" });
    }
  }

  try {
    const out = await callClaudeChat(SYS, messages);
    if (out.error) return res.status(out.status).json({ error: out.error });
    return res.status(200).json({ text: out.text });
  } catch (e) {
    console.error("interview error:", e);
    return res.status(500).json({ error: "Request failed" });
  }
}
