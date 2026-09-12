// /api/build.js — Vercel serverless function
// =============================================================================
// One endpoint, two modes:
//   BUILD   — a plain-English brief -> a fully specified character: identity,
//             face, hair, wardrobe, vibe, voice, backstory, and the scene
//             defaults (lighting, camera, background) the prompts are built on.
//   REFINE  — pass `previousCharacter` + `instructions` ("older", "less
//             corporate", "give her glasses") -> the same character adjusted,
//             identity anchors kept unless the instructions target them.
//
// The prompt strings the user copies are assembled in the BROWSER from these
// fields, so hand-editing a field updates every prompt. The server's job is the
// casting and the wording of the fields — nothing else.
//
// SETUP: Vercel -> Project -> Settings -> Environment Variables -> ANTHROPIC_API_KEY
// =============================================================================

const CHAR_SYS = `You are a casting director and character designer for faceless short-form content (Instagram Reels, TikTok, YouTube Shorts) produced with AI image and video models.

Your job: turn a creator's brief into ONE specific, physically consistent human character that an image model can reproduce identically across hundreds of generations.

THE RULES OF A REPRODUCIBLE CHARACTER:
1. SPECIFIC, NOT FLATTERING. "Almond eyes, deep brown, slightly hooded left lid" reproduces. "Beautiful eyes" does not. Every physical field must be something a model can draw the same way twice.
2. ANCHORS BEAT ADJECTIVES. Give each character 2-3 hard identity anchors — a mole, a gap tooth, a scar, a cowlick, heterochromia, a crooked incisor, a distinct brow shape. These are what hold identity across shots. Never leave "marks" empty.
3. ONE PERSON, NOT A TYPE. Age is a number or a tight range, never "young". Build and height are concrete.
4. REAL, NOT RENDERED. Describe skin as skin: pores, texture, uneven tone, fine lines where the age warrants. Avoid anything that reads airbrushed, glossy, or CGI.
5. FIT THE NICHE. Wardrobe, vibe and setting must suit the creator's niche and audience. A finance channel is not cottagecore. If the brief names a niche, honour it.
6. NO REAL PEOPLE. Never describe, name, or approximate a real or famous person, living or dead — not as a look-alike, not "in the style of", not a celebrity name as shorthand. If the brief names one, cast an original character that fits the intent instead and say nothing about the swap.

WRITE THE FIELDS FOR A PROMPT, NOT FOR A NOVEL. Each physical field is a short phrase (2-10 words), lowercase, no full sentences, no trailing periods. The backstory and voice fields are the only prose.

FIELD GUIDE:
- name: a plain first + last name that suits the character. Not a stage name.
- tagline: 4-8 words placing them ("burnt-out nurse turned money coach").
- identity.age: a number or tight range ("34", "late 30s").
- identity.gender_presentation, identity.heritage, identity.build, identity.height: concrete and short.
- face.*: shape, eyes, brows, nose, lips, jaw, skin, marks. marks = the identity anchors, comma separated.
- hair.*: length, texture, color, style.
- wardrobe.signature: the outfit they wear in most content. alt1/alt2: two variants for variety, same person.
- vibe.energy, vibe.posture, vibe.expression: how they hold themselves and their default resting face.
- voice.tone, voice.pace: how they speak, for a voice-cloning brief.
- voice.phrases: 3-5 things they'd actually say, in their register.
- voice.never: 3-5 things they'd never say or do on camera.
- backstory: 2-3 sentences. Where they come from, why the audience trusts them, what they're not.
- scene.lighting, scene.camera, scene.background: the default look of their talking-head content. camera should name a lens and framing.
- shots: 4 short shot ideas for this character's content, each a plain phrase ("talking to camera at kitchen island, morning light"). No camera jargon.

REFINE MODE — when a previous character and instructions are given: change only what the instructions ask for and whatever must change to stay coherent. Keep the name and the identity anchors unless the instructions target them. Return the complete character, not a diff.

Respond ONLY as JSON, no markdown, no commentary:
{
 "name": "",
 "tagline": "",
 "identity": { "age": "", "gender_presentation": "", "heritage": "", "build": "", "height": "" },
 "face": { "shape": "", "eyes": "", "brows": "", "nose": "", "lips": "", "jaw": "", "skin": "", "marks": "" },
 "hair": { "length": "", "texture": "", "color": "", "style": "" },
 "wardrobe": { "signature": "", "alt1": "", "alt2": "" },
 "vibe": { "energy": "", "posture": "", "expression": "" },
 "voice": { "tone": "", "pace": "", "phrases": ["", "", ""], "never": ["", "", ""] },
 "backstory": "",
 "scene": { "lighting": "", "camera": "", "background": "" },
 "shots": ["", "", "", ""]
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
      model: "claude-sonnet-5",
      max_tokens: 2500,
      system: CHAR_SYS,
      messages: [{ role: "user", content }],
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!originAllowed(req)) return res.status(403).json({ error: "Forbidden" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "Server not configured" });

  const { brief, niche, platform, refUrl, previousCharacter, instructions } = req.body || {};
  const isRefine =
    previousCharacter && typeof instructions === "string" && instructions.trim();

  if (!isRefine) {
    if (typeof brief !== "string" || !brief.trim() || brief.length > 6000) {
      return res.status(400).json({ error: "Describe the character first" });
    }
  }

  let text;
  if (isRefine) {
    let prev;
    try {
      prev = JSON.stringify(previousCharacter).slice(0, 12000);
    } catch {
      return res.status(400).json({ error: "Invalid character" });
    }
    text =
      "EXISTING CHARACTER:\n" + prev +
      "\n\nREFINE INSTRUCTIONS:\n" + instructions.trim().slice(0, 1000) +
      "\n\nReturn the complete updated character.";
  } else {
    text =
      "BRIEF:\n" + brief.trim() +
      (niche ? "\n\nNICHE / AUDIENCE:\n" + String(niche).slice(0, 1500) : "") +
      (platform ? "\n\nPLATFORM:\n" + String(platform).slice(0, 200) : "") +
      "\n\nCast the character.";
  }

  // A reference photo is best-effort: try with the image, fall back without it.
  const withImage =
    typeof refUrl === "string" && /^https:\/\//.test(refUrl)
      ? [
          { type: "image", source: { type: "url", url: refUrl } },
          {
            type: "text",
            text:
              "The image is a STYLE AND VIBE reference only — match its mood, lighting and wardrobe register. Do not describe or reproduce the person in it; cast an original character.\n\n" +
              text,
          },
        ]
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
    console.error("build handler error:", e);
    return res.status(500).json({ error: "Request failed" });
  }
}
