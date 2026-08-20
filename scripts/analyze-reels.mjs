#!/usr/bin/env node
// =============================================================================
// analyze-reels.mjs — turn scraped reels into a marketing brief
//
// Reads the JSON that scrape-reels.mjs writes, has Claude find the patterns
// across the winners (hooks, angles, CTAs, format) and writes a structured
// brief plus a readable report.
//
//   export ANTHROPIC_API_KEY=sk-ant-...
//   node scripts/scrape-reels.mjs                     # → reels_data.json
//   node scripts/analyze-reels.mjs                    # → reels_analysis.json
//
// Engagement metrics are computed here, not by the model — arithmetic is the
// one thing a script does better, and it keeps the model on the reasoning.
// =============================================================================

import { readFile, writeFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5";

// ---------------------------------------------------------------- args ------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq !== -1) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`
analyze-reels.mjs — marketing brief from scraped reels

  --in <file>       scraper output          (default: reels_data.json)
  --out <file>      structured brief        (default: reels_analysis.json)
  --report <file>   markdown report         (default: reels_analysis.md)
  --audience <who>  who you're marketing to, e.g. "solo founders"
  --offer <what>    what you sell — sharpens the content ideas
  --effort <level>  low | medium | high | xhigh | max     (default: high)
  --dry-run         print the prompt and exit, calling no API
`);
  process.exit(0);
}

const IN = String(args.in || "reels_data.json");
const OUT = String(args.out || "reels_analysis.json");
const REPORT = String(args.report || "reels_analysis.md");
const EFFORT = String(args.effort || "high");
const AUDIENCE = args.audience ? String(args.audience) : null;
const OFFER = args.offer ? String(args.offer) : null;

function die(msg) {
  console.error("Error: " + msg);
  process.exit(1);
}

// -------------------------------------------------------------- schema ------
// Every property is required with additionalProperties:false — structured
// outputs need a closed schema, and a closed schema is what makes the response
// safe to index into without guarding every field.
const obj = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const ANALYSIS_SCHEMA = obj({
  summary: { type: "string", description: "2-4 sentences: what is actually winning here and why" },
  hook_patterns: {
    type: "array",
    description: "Opening patterns that recur across the highest-view reels",
    items: obj({
      pattern: { type: "string" },
      why_it_works: { type: "string" },
      example_ranks: { type: "array", items: { type: "integer" } },
    }),
  },
  content_angles: {
    type: "array",
    items: obj({
      angle: { type: "string" },
      description: { type: "string" },
      example_ranks: { type: "array", items: { type: "integer" } },
    }),
  },
  cta_patterns: {
    type: "array",
    items: obj({
      cta: { type: "string" },
      placement: { type: "string", enum: ["hook", "mid", "end", "caption", "none"] },
      example_ranks: { type: "array", items: { type: "integer" } },
    }),
  },
  format_notes: obj({
    duration: { type: "string", description: "What the durations of the winners suggest" },
    caption_style: { type: "string" },
    hashtag_strategy: { type: "string" },
  }),
  outliers: {
    type: "array",
    description: "Reels whose engagement rate diverges sharply from their view rank",
    items: obj({ rank: { type: "integer" }, observation: { type: "string" } }),
  },
  content_ideas: {
    type: "array",
    description: "Specific reels to make next, built from the patterns above",
    items: obj({
      title: { type: "string" },
      hook: { type: "string", description: "The literal first line, ready to film" },
      angle: { type: "string" },
      why_it_should_work: { type: "string" },
    }),
  },
  what_to_avoid: {
    type: "array",
    description: "Patterns visible in the data that correlate with weaker performance",
    items: { type: "string" },
  },
});

// ----------------------------------------------------------- input prep -----
const pct = (n) => (n * 100).toFixed(2) + "%";

function summarizeReels(reels) {
  return reels.map((r) => {
    const views = r.views || 0;
    const engagements = (r.likes || 0) + (r.comments || 0);
    return {
      rank: r.rank,
      username: r.username,
      views,
      likes: r.likes,
      comments: r.comments,
      // Rate, not raw counts: it separates "the algorithm pushed this" from
      // "people actually responded to this", which is the interesting signal.
      engagementRate: views ? pct(engagements / views) : null,
      durationSec: r.durationSec,
      postedAt: r.postedAt,
      caption: r.caption || "",
      url: r.url,
    };
  });
}

function buildPrompt(data, reels) {
  const q = data.query?.hashtag || data.query?.username || "the scraped set";
  const lines = [
    "You're analyzing the top-performing Instagram reels for " + q + ", scraped " +
      (data.scrapedAt || "recently") + " and covering the last " + (data.windowDays || "?") +
      " days. They are ranked by view count, rank 1 highest.",
    "",
    "Find the patterns that explain the performance, then turn them into reels I can film.",
    "Work from what the data actually shows — cite ranks for every pattern you name, and if a",
    "pattern is thin or the captions don't support a conclusion, say so instead of inventing one.",
  ];
  if (AUDIENCE) lines.push("", "Audience: " + AUDIENCE + ".");
  if (OFFER) lines.push("What I sell: " + OFFER + ". Bias the content ideas toward earning attention for this.");
  lines.push(
    "",
    "Engagement rate is (likes + comments) / views, computed from the data — a reel can rank high",
    "on views and low on engagement rate, and that gap is worth calling out.",
    "",
    "Reels:",
    JSON.stringify(reels, null, 2)
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------- report ----
function toMarkdown(a, data) {
  const q = data.query?.hashtag || data.query?.username || "scraped reels";
  const ranks = (r) => (r.length ? " _(ranks " + r.join(", ") + ")_" : "");
  const out = [
    "# Reel analysis — " + q,
    "",
    "_" + (data.counts?.returned ?? "?") + " reels, last " + (data.windowDays ?? "?") +
      " days, ranked by views. Analyzed " + new Date().toISOString().slice(0, 10) + "._",
    "",
    a.summary,
    "",
    "## Hook patterns",
    ...a.hook_patterns.map((h) => "- **" + h.pattern + "** — " + h.why_it_works + ranks(h.example_ranks)),
    "",
    "## Content angles",
    ...a.content_angles.map((c) => "- **" + c.angle + "** — " + c.description + ranks(c.example_ranks)),
    "",
    "## CTAs",
    ...a.cta_patterns.map((c) => "- **" + c.cta + "** (" + c.placement + ")" + ranks(c.example_ranks)),
    "",
    "## Format",
    "- **Duration** — " + a.format_notes.duration,
    "- **Captions** — " + a.format_notes.caption_style,
    "- **Hashtags** — " + a.format_notes.hashtag_strategy,
    "",
    "## Outliers",
    ...a.outliers.map((o) => "- **Rank " + o.rank + "** — " + o.observation),
    "",
    "## Make these next",
    ...a.content_ideas.flatMap((i, n) => [
      "### " + (n + 1) + ". " + i.title,
      "> " + i.hook,
      "",
      "**Angle:** " + i.angle + "  ",
      "**Why:** " + i.why_it_should_work,
      "",
    ]),
    "## Avoid",
    ...a.what_to_avoid.map((w) => "- " + w),
    "",
  ];
  return out.join("\n");
}

// ------------------------------------------------------------------ main ----
async function main() {
  let data;
  try {
    data = JSON.parse(await readFile(IN, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") {
      die("no " + IN + " — run `node scripts/scrape-reels.mjs` first, or pass --in <file>.");
    }
    die("couldn't read " + IN + ": " + err.message);
  }

  const reels = Array.isArray(data.reels) ? data.reels : Array.isArray(data) ? data : null;
  if (!reels || !reels.length) die(IN + " has no `reels` array to analyze.");

  const summarized = summarizeReels(reels);
  const prompt = buildPrompt(data, summarized);

  if (args["dry-run"]) {
    console.log(prompt);
    console.error("\n[dry run] " + summarized.length + " reels, " + prompt.length +
      " chars. No API call made.");
    return;
  }

  const client = new Anthropic();

  // Cost is worth knowing before a large brief, and it's one cheap call.
  try {
    const count = await client.messages.countTokens({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    });
    console.log("Input: ~" + count.input_tokens.toLocaleString() + " tokens ($" +
      (count.input_tokens * 5e-6).toFixed(4) + " at $5/M)");
  } catch {
    // Not worth failing the run over a pre-flight estimate.
  }

  console.log("Analyzing " + summarized.length + " reels with " + MODEL + " (effort: " + EFFORT + ") ...");

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // Adaptive thinking: pattern-finding across 50 captions is exactly the kind
    // of work that benefits from it, and the model paces its own depth.
    thinking: { type: "adaptive" },
    output_config: {
      effort: EFFORT,
      format: { type: "json_schema", schema: ANALYSIS_SCHEMA },
    },
    // Server-side fallback: if a safety classifier declines the request, the
    // API re-runs it on the recommended substitute rather than handing back a
    // refusal. Routed by refusal category, so no model to pin or maintain.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: prompt }],
  });

  // Check stop_reason before touching content — a refused turn still returns 200.
  if (response.stop_reason === "refusal") {
    const d = response.stop_details;
    die("the model declined this request" + (d?.category ? " (" + d.category + ")" : "") +
      (d?.explanation ? ": " + d.explanation : "") + ". Check the captions in " + IN + ".");
  }

  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  if (!text.trim()) die("empty response from the model — rerun, or lower --effort.");

  let analysis;
  try {
    analysis = JSON.parse(text);
  } catch {
    die("the response wasn't valid JSON despite the schema. Raw text:\n" + text.slice(0, 500));
  }

  await writeFile(OUT, JSON.stringify({
    source: IN,
    query: data.query,
    model: response.model,
    analyzedAt: new Date().toISOString(),
    reelsAnalyzed: summarized.length,
    analysis,
  }, null, 2) + "\n", "utf8");
  await writeFile(REPORT, toMarkdown(analysis, data), "utf8");

  console.log("\n" + analysis.summary);
  console.log("\nWrote " + OUT + " and " + REPORT);
  console.log("  " + analysis.hook_patterns.length + " hook patterns, " +
    analysis.content_angles.length + " angles, " +
    analysis.content_ideas.length + " reel ideas");
  console.log("  " + response.usage.input_tokens + " in / " +
    response.usage.output_tokens + " out");
}

main().catch((err) => {
  if (err instanceof Anthropic.AuthenticationError) {
    die("Anthropic rejected the credentials. Set ANTHROPIC_API_KEY, or run `ant auth login`.");
  }
  if (err instanceof Anthropic.RateLimitError) die("rate limited — wait a moment and rerun.");
  if (err instanceof Anthropic.APIError) die("Anthropic API error " + err.status + ": " + err.message);
  die(err.message);
});
