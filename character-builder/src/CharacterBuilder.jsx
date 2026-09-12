import React, { useState, useEffect, useRef } from "react";

// CHARACTER BUILDER — build the face, lock the look.
// Describe a character in plain words -> the server casts a fully specified,
// reproducible human (face, hair, wardrobe, vibe, voice, backstory) -> the
// browser assembles the prompts you actually paste into an image model:
// an identity-lock block, a two-panel reference sheet, and per-shot prompts.
// Every field is editable and every prompt rebuilds live from the fields, so
// a tweak to "hair color" updates all of them. Your roster persists on this
// device. No API keys ever touch this file.

const GOLD = "#C9A227";
const INK = "#14110c";
const PANEL = "#1d1913";
const PANEL2 = "#24201a";
const LINE = "#332c20";
const CREAM = "#f4efe4";
const MUT = "#a89c84";

// Same-origin when frontend + api are one Vercel project. If you host the
// frontend elsewhere, set the full URL: "https://your-project.vercel.app"
const API_BASE = "";

const FONT = "Helvetica Neue, Arial, sans-serif";
const btn = { background: GOLD, color: INK, border: "none", borderRadius: 8, padding: "13px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT };
const ghost = { background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT };
const quiet = { ...ghost, borderColor: LINE, color: MUT };
const lbl = { display: "block", fontFamily: FONT, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: MUT, marginBottom: 7 };
const ta = { width: "100%", boxSizing: "border-box", background: PANEL2, color: CREAM, border: `1px solid ${LINE}`, borderRadius: 8, padding: 12, fontSize: 14, fontFamily: FONT, resize: "vertical" };
const inp = { ...ta, padding: "9px 11px", fontSize: 13 };
const card = { background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 };
const chip = { display: "inline-block", background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 999, padding: "4px 12px", fontSize: 12, color: CREAM, marginRight: 8, marginBottom: 6 };
const mono = { ...ta, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 12.5, lineHeight: 1.55 };

const BRIEF_EXAMPLE = `A woman in her mid-30s who used to work a normal job and now coaches people on money.
Looks like someone you'd actually trust — not a guru. Calm, dressed simply, no jewellery.
Films at home, warm light, plain background. Should read honest and a bit tired in a good way.`;

const NICHE_EXAMPLE = `Coaches and course creators who can't close DMs into sales.
Audience: 25-45, mostly women, service-based, sceptical of hype.`;

const PLATFORMS = ["Reels / TikTok", "YouTube Shorts", "YouTube long form", "Static posts"];

// ---------------------------------------------------------------------------
// prompt composition — the whole point of keeping the fields structured
// ---------------------------------------------------------------------------

// Joins only the parts that actually have text, so a half-filled character
// still produces a clean prompt instead of "a , , woman".
function j(parts, sep) {
  return parts.map((p) => (p == null ? "" : String(p).trim())).filter(Boolean).join(sep == null ? ", " : sep);
}

const NEGATIVE =
  "plastic skin, airbrushed, beauty filter, CGI, 3d render, illustration, cartoon, " +
  "waxy texture, over-smoothed, uncanny eyes, extra fingers, deformed hands, " +
  "warped face, asymmetric eyes, text, watermark, logo, oversaturated, HDR halo, " +
  "different person, changed face shape, changed eye color";

// The identity lock: the block you paste at the top of EVERY generation so the
// same person comes back. Physical facts only — no scene, no wardrobe mood.
function identityLock(c) {
  const id = c.identity || {}, f = c.face || {}, h = c.hair || {};
  return j([
    j([id.age && id.age + " years old", id.gender_presentation, id.heritage], " "),
    id.build && id.build + " build",
    id.height,
    f.shape && f.shape + " face",
    f.eyes && f.eyes + " eyes",
    f.brows && f.brows + " brows",
    f.nose && f.nose + " nose",
    f.lips && f.lips + " lips",
    f.jaw && f.jaw + " jaw",
    f.skin,
    f.marks,
    j([h.length, h.texture, h.color, "hair"], " "),
    h.style,
  ]);
}

// A full still: identity + wardrobe + how they hold themselves + the scene.
function fullPrompt(c, outfitKey, shot) {
  const w = c.wardrobe || {}, v = c.vibe || {}, s = c.scene || {};
  return j([
    "photorealistic photograph of the same person throughout",
    identityLock(c),
    "wearing " + (w[outfitKey] || w.signature || "simple neutral clothing"),
    v.posture,
    v.expression && v.expression + " expression",
    v.energy,
    shot || s.background,
    s.lighting,
    s.camera,
    "natural skin texture with visible pores, sharp focus on the eyes, shot on a full-frame camera",
  ]);
}

// Two-panel reference sheet — beauty close-up + full body, one identical person
// on a seamless grey sweep. This is the image you keep and reuse forever.
function sheetPrompt(c) {
  const w = c.wardrobe || {};
  return (
    "Character reference sheet, two panels side by side, the SAME IDENTICAL PERSON in both, " +
    "seamless neutral grey studio background, soft even studio lighting, photorealistic, no text, no labels.\n\n" +
    "LEFT PANEL — tight beauty close-up, head and shoulders, straight to camera, neutral relaxed expression, " +
    "eyes to lens, natural skin texture with visible pores and fine lines, no makeup beyond bare minimum.\n\n" +
    "RIGHT PANEL — full body, standing, front-facing, arms relaxed at sides, feet fully in frame, " +
    "wearing " + (w.signature || "simple neutral clothing") + ".\n\n" +
    "THE PERSON (identical in both panels): " + identityLock(c) + ".\n\n" +
    "Shot on an 85mm lens, f/4, sharp focus throughout, consistent facial structure and proportions across both panels."
  );
}

// A compact brief for a voice-cloning or VO tool.
function voiceBrief(c) {
  const v = c.voice || {};
  const lines = [];
  if (c.name) lines.push("Character: " + c.name + (c.tagline ? " — " + c.tagline : ""));
  if (v.tone) lines.push("Tone: " + v.tone);
  if (v.pace) lines.push("Pace: " + v.pace);
  if ((c.identity || {}).age) lines.push("Age: " + c.identity.age);
  if (Array.isArray(v.phrases) && v.phrases.filter(Boolean).length)
    lines.push("Says things like: " + v.phrases.filter(Boolean).map((p) => '"' + p + '"').join(" / "));
  if (Array.isArray(v.never) && v.never.filter(Boolean).length)
    lines.push("Never: " + v.never.filter(Boolean).join(", "));
  if (c.backstory) lines.push("Who they are: " + c.backstory);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------

async function post(path, body) {
  const r = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Error " + r.status);
  return data;
}

function parseJSON(t, fb) {
  const c = (t || "").replace(/```json|```/g, "").trim();
  try { return JSON.parse(c); } catch (e) {}
  const m = c.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return fb;
}

// Every character passes through here, so a partial or odd AI response can
// never leave a field undefined and crash an input.
function normalize(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const pick = (v) => (v && typeof v === "object" ? v : {});
  const str = (v) => (typeof v === "string" ? v : "");
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  const i = pick(o.identity), f = pick(o.face), h = pick(o.hair),
    w = pick(o.wardrobe), v = pick(o.vibe), vo = pick(o.voice), s = pick(o.scene);
  return {
    name: str(o.name) || "Untitled character",
    tagline: str(o.tagline),
    identity: { age: str(i.age), gender_presentation: str(i.gender_presentation), heritage: str(i.heritage), build: str(i.build), height: str(i.height) },
    face: { shape: str(f.shape), eyes: str(f.eyes), brows: str(f.brows), nose: str(f.nose), lips: str(f.lips), jaw: str(f.jaw), skin: str(f.skin), marks: str(f.marks) },
    hair: { length: str(h.length), texture: str(h.texture), color: str(h.color), style: str(h.style) },
    wardrobe: { signature: str(w.signature), alt1: str(w.alt1), alt2: str(w.alt2) },
    vibe: { energy: str(v.energy), posture: str(v.posture), expression: str(v.expression) },
    voice: { tone: str(vo.tone), pace: str(vo.pace), phrases: list(vo.phrases), never: list(vo.never) },
    backstory: str(o.backstory),
    scene: { lighting: str(s.lighting), camera: str(s.camera), background: str(s.background) },
    shots: list(o.shots),
  };
}

function download(name, text, type) {
  const blob = new Blob([text], { type: (type || "text/plain") + ";charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function csvCell(v) {
  return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
}

function buildCSV(chars) {
  const header = ["name", "tagline", "age", "identity_lock", "signature_outfit", "reference_sheet_prompt", "talking_head_prompt", "voice_brief", "negative_prompt"];
  const lines = [header.join(",")];
  for (const c of chars) {
    lines.push([
      csvCell(c.name), csvCell(c.tagline), csvCell((c.identity || {}).age),
      csvCell(identityLock(c)), csvCell((c.wardrobe || {}).signature),
      csvCell(sheetPrompt(c)), csvCell(fullPrompt(c, "signature", null)),
      csvCell(voiceBrief(c)), csvCell(NEGATIVE),
    ].join(","));
  }
  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------

// Phone-width detection — the grids below are inline styles, so the column
// counts collapse here rather than in a media query.
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return narrow;
}

function ListField({ label, items, onChange, rows }) {
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <label style={lbl}>{label}</label>
      <textarea
        rows={rows || 3}
        style={ta}
        value={(items || []).join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))}
      />
    </div>
  );
}

function Field({ label, value, onChange, wide }) {
  return (
    <div style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <label style={lbl}>{label}</label>
      <input style={inp} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Group({ title, children, cols, narrow }) {
  const n = narrow ? Math.min(cols || 4, 2) : cols || 4;
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: GOLD, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 12 }}>{children}</div>
    </div>
  );
}

function PromptBox({ label, hint, text, rows }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // Clipboard is blocked in some embedded/insecure contexts — fall back to
      // selecting the text so the user can still copy it by hand.
      const el = document.getElementById("pb_" + label.replace(/\W/g, ""));
      if (el) { el.focus(); el.select(); }
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <label style={{ ...lbl, marginBottom: 0 }}>{label}</label>
        <button style={{ ...quiet, padding: "4px 12px", fontSize: 12, color: copied ? "#7bc47f" : MUT, borderColor: copied ? "#7bc47f" : LINE }} onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {hint && <div style={{ fontSize: 12.5, color: MUT, margin: "6px 0 7px" }}>{hint}</div>}
      <textarea id={"pb_" + label.replace(/\W/g, "")} readOnly rows={rows || 5} style={mono} value={text} />
    </div>
  );
}

export default function CharacterBuilder() {
  const [brief, setBrief] = useState("");
  const [niche, setNiche] = useState("");
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [refUrl, setRefUrl] = useState("");
  const [roster, setRoster] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const narrow = useNarrow();
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const n = localStorage.getItem("cb_niche");
      if (n) setNiche(n);
      const p = localStorage.getItem("cb_platform");
      if (p) setPlatform(p);
      const r = JSON.parse(localStorage.getItem("cb_roster") || "[]");
      if (Array.isArray(r)) {
        setRoster(r);
        if (r.length) setOpenId(r[0].id);
      }
    } catch (e) {}
    loaded.current = true;
  }, []);
  useEffect(() => { if (loaded.current) localStorage.setItem("cb_niche", niche); }, [niche]);
  useEffect(() => { if (loaded.current) localStorage.setItem("cb_platform", platform); }, [platform]);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem("cb_roster", JSON.stringify(roster)); } catch (e) {}
  }, [roster]);

  const patch = (id, p) =>
    setRoster((rs) => rs.map((r) => (r.id === id ? { ...r, ...(typeof p === "function" ? p(r) : p) } : r)));

  // Edits a nested field by path, e.g. setIn(id, ["face", "eyes"], value).
  const setIn = (id, path, value) =>
    setRoster((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, c: { ...r.c } };
        if (path.length === 1) next.c[path[0]] = value;
        else next.c[path[0]] = { ...next.c[path[0]], [path[1]]: value };
        return next;
      })
    );

  async function build() {
    if (!brief.trim()) { setErr("Describe the character first — a few plain sentences is enough."); return; }
    setErr("");
    setBusy("build");
    try {
      const r = await post("/api/build", {
        brief,
        niche,
        platform,
        refUrl: /^https:\/\//.test(refUrl.trim()) ? refUrl.trim() : undefined,
      });
      const c = normalize(parseJSON(r.text, null));
      const entry = { id: Date.now() + "_" + Math.random().toString(36).slice(2, 7), c, brief, refineNote: "", history: [] };
      setRoster((rs) => [entry, ...rs]);
      setOpenId(entry.id);
      setBrief("");
    } catch (e) {
      setErr(e.message || "Build failed");
    } finally {
      setBusy("");
    }
  }

  async function refine(entry) {
    const note = (entry.refineNote || "").trim();
    if (!note) { setErr('Tell it what to change — e.g. "a bit older" or "give him glasses and a beard".'); return; }
    setErr("");
    setBusy(entry.id);
    try {
      const r = await post("/api/build", { previousCharacter: entry.c, instructions: note });
      const c = normalize(parseJSON(r.text, null));
      patch(entry.id, (e) => ({ c, refineNote: "", history: [...(e.history || []), { c: e.c, note }] }));
    } catch (e) {
      setErr(e.message || "Refine failed");
    } finally {
      setBusy("");
    }
  }

  function undo(entry) {
    const h = entry.history || [];
    if (!h.length) return;
    const last = h[h.length - 1];
    patch(entry.id, { c: last.c, history: h.slice(0, -1) });
  }

  function duplicate(entry) {
    const copy = {
      id: Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      c: { ...entry.c, name: entry.c.name + " (variant)" },
      brief: entry.brief,
      refineNote: "",
      history: [],
    };
    setRoster((rs) => [copy, ...rs]);
    setOpenId(copy.id);
  }

  function remove(entry) {
    if (!confirm("Delete " + entry.c.name + "? Export first if you want to keep the prompts.")) return;
    setRoster((rs) => rs.filter((r) => r.id !== entry.id));
  }

  function exportJSON() {
    if (!roster.length) { setErr("No characters yet."); return; }
    download("characters.json", JSON.stringify(roster.map((r) => r.c), null, 2), "application/json");
  }

  function exportCSV() {
    if (!roster.length) { setErr("No characters yet."); return; }
    download("characters.csv", buildCSV(roster.map((r) => r.c)), "text/csv");
  }

  function exportOne(entry) {
    const c = entry.c;
    const txt = [
      c.name + (c.tagline ? " — " + c.tagline : ""),
      "",
      "=== IDENTITY LOCK (paste at the top of every generation) ===",
      identityLock(c),
      "",
      "=== REFERENCE SHEET ===",
      sheetPrompt(c),
      "",
      "=== TALKING HEAD ===",
      fullPrompt(c, "signature", null),
      "",
      "=== SHOTS ===",
      ...(c.shots || []).filter(Boolean).map((s, i) => (i + 1) + ". " + fullPrompt(c, "signature", s) + "\n"),
      "=== VOICE BRIEF ===",
      voiceBrief(c),
      "",
      "=== NEGATIVE PROMPT ===",
      NEGATIVE,
    ].join("\n");
    download(c.name.replace(/\W+/g, "-").toLowerCase() + ".txt", txt);
  }

  return (
    <div style={{ minHeight: "100vh", background: INK, color: CREAM, fontFamily: FONT, padding: narrow ? "28px 16px" : "40px 20px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>The Digital Closer</div>
        <h1 style={{ fontSize: 32, margin: "0 0 4px" }}>Character Builder</h1>
        <p style={{ color: MUT, marginTop: 0, maxWidth: 760 }}>
          Describe the person you want on camera. It casts a <b style={{ color: CREAM }}>specific, reproducible</b> human —
          face, hair, wardrobe, voice, backstory — then builds the prompts you actually paste into an image model: an
          <b style={{ color: CREAM }}> identity lock</b> that brings the same face back every time, a two-panel
          <b style={{ color: CREAM }}> reference sheet</b>, and a prompt per shot. Every field is editable and every prompt
          rebuilds from the fields. Your roster saves on this device.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 20, marginTop: 24 }}>
          <div style={card}>
            <label style={lbl}>1 · Describe the character</label>
            <textarea rows={9} style={ta} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={BRIEF_EXAMPLE} />
            {!brief && (
              <button style={{ ...ghost, marginTop: 10 }} onClick={() => setBrief(BRIEF_EXAMPLE)}>Use example as starting point</button>
            )}
          </div>
          <div style={card}>
            <label style={lbl}>2 · Your niche &amp; audience (saved on this device)</label>
            <textarea rows={5} style={ta} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder={NICHE_EXAMPLE} />
            <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div>
                <label style={lbl}>Built for</label>
                <select style={inp} value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  {PLATFORMS.map((p) => <option key={p} value={p} style={{ background: PANEL2 }}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Style reference URL (optional)</label>
                <input style={inp} value={refUrl} onChange={(e) => setRefUrl(e.target.value)} placeholder="https://… image for mood only" />
              </div>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button style={{ ...btn, opacity: busy === "build" ? 0.6 : 1 }} disabled={busy === "build"} onClick={build}>
                {busy === "build" ? "Casting…" : "Build character"}
              </button>
              <button style={ghost} onClick={exportCSV} disabled={!roster.length}>Export CSV ({roster.length})</button>
              <button style={quiet} onClick={exportJSON} disabled={!roster.length}>Export JSON</button>
            </div>
            <div style={{ fontSize: 12, color: MUT, marginTop: 10 }}>
              A reference URL is read for mood, lighting and wardrobe only — it never copies the person in it.
            </div>
          </div>
        </div>

        {err && (
          <div style={{ marginTop: 18, background: "#2a1d15", border: "1px solid #6b4a2f", borderRadius: 10, padding: "12px 14px", color: "#e8bb95", fontSize: 14 }}>
            {err}
            <button style={{ ...quiet, marginLeft: 12, padding: "3px 10px", fontSize: 12 }} onClick={() => setErr("")}>Dismiss</button>
          </div>
        )}

        {roster.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <label style={lbl}>3 · Your roster — {roster.length} character{roster.length === 1 ? "" : "s"}</label>

            {roster.map((entry) => {
              const c = entry.c;
              const open = openId === entry.id;
              const working = busy === entry.id;
              return (
                <div key={entry.id} style={{ ...card, marginBottom: 14 }}>
                  <div
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", cursor: "pointer" }}
                    onClick={() => setOpenId(open ? null : entry.id)}
                  >
                    <div>
                      <div style={{ fontSize: 19, fontWeight: 700 }}>
                        <span style={{ color: GOLD, marginRight: 10 }}>{open ? "−" : "+"}</span>
                        {c.name}
                      </div>
                      {c.tagline && <div style={{ color: MUT, fontSize: 13.5, marginTop: 3, marginLeft: 26 }}>{c.tagline}</div>}
                    </div>
                    <div style={{ fontSize: 12, color: working ? GOLD : MUT, textTransform: "uppercase", letterSpacing: 1 }}>
                      {working ? "refining…" : j([c.identity.age, c.identity.build], " · ")}
                    </div>
                  </div>

                  {open && (
                    <div>
                      <div style={{ marginTop: 14 }}>
                        {c.vibe.energy && <span style={chip}><b style={{ color: GOLD }}>energy</b> {c.vibe.energy}</span>}
                        {c.vibe.posture && <span style={chip}><b style={{ color: GOLD }}>posture</b> {c.vibe.posture}</span>}
                        {c.voice.tone && <span style={chip}><b style={{ color: GOLD }}>voice</b> {c.voice.tone}</span>}
                        {c.face.marks && <span style={chip}><b style={{ color: GOLD }}>anchors</b> {c.face.marks}</span>}
                      </div>
                      {c.backstory && (
                        <div style={{ fontSize: 14, color: CREAM, marginTop: 10, lineHeight: 1.55, maxWidth: 780 }}>{c.backstory}</div>
                      )}

                      <Group title="Identity" cols={5} narrow={narrow}>
                        <Field label="Age" value={c.identity.age} onChange={(v) => setIn(entry.id, ["identity", "age"], v)} />
                        <Field label="Presents as" value={c.identity.gender_presentation} onChange={(v) => setIn(entry.id, ["identity", "gender_presentation"], v)} />
                        <Field label="Heritage" value={c.identity.heritage} onChange={(v) => setIn(entry.id, ["identity", "heritage"], v)} />
                        <Field label="Build" value={c.identity.build} onChange={(v) => setIn(entry.id, ["identity", "build"], v)} />
                        <Field label="Height" value={c.identity.height} onChange={(v) => setIn(entry.id, ["identity", "height"], v)} />
                      </Group>

                      <Group title="Face — the part that must never drift" cols={4} narrow={narrow}>
                        <Field label="Face shape" value={c.face.shape} onChange={(v) => setIn(entry.id, ["face", "shape"], v)} />
                        <Field label="Eyes" value={c.face.eyes} onChange={(v) => setIn(entry.id, ["face", "eyes"], v)} />
                        <Field label="Brows" value={c.face.brows} onChange={(v) => setIn(entry.id, ["face", "brows"], v)} />
                        <Field label="Nose" value={c.face.nose} onChange={(v) => setIn(entry.id, ["face", "nose"], v)} />
                        <Field label="Lips" value={c.face.lips} onChange={(v) => setIn(entry.id, ["face", "lips"], v)} />
                        <Field label="Jaw" value={c.face.jaw} onChange={(v) => setIn(entry.id, ["face", "jaw"], v)} />
                        <Field label="Skin" value={c.face.skin} onChange={(v) => setIn(entry.id, ["face", "skin"], v)} />
                        <Field label="Identity anchors" value={c.face.marks} onChange={(v) => setIn(entry.id, ["face", "marks"], v)} />
                      </Group>

                      <Group title="Hair" cols={4} narrow={narrow}>
                        <Field label="Length" value={c.hair.length} onChange={(v) => setIn(entry.id, ["hair", "length"], v)} />
                        <Field label="Texture" value={c.hair.texture} onChange={(v) => setIn(entry.id, ["hair", "texture"], v)} />
                        <Field label="Colour" value={c.hair.color} onChange={(v) => setIn(entry.id, ["hair", "color"], v)} />
                        <Field label="Style" value={c.hair.style} onChange={(v) => setIn(entry.id, ["hair", "style"], v)} />
                      </Group>

                      <Group title="Wardrobe" cols={3} narrow={narrow}>
                        <Field label="Signature outfit" value={c.wardrobe.signature} onChange={(v) => setIn(entry.id, ["wardrobe", "signature"], v)} />
                        <Field label="Alternate 1" value={c.wardrobe.alt1} onChange={(v) => setIn(entry.id, ["wardrobe", "alt1"], v)} />
                        <Field label="Alternate 2" value={c.wardrobe.alt2} onChange={(v) => setIn(entry.id, ["wardrobe", "alt2"], v)} />
                      </Group>

                      <Group title="Presence &amp; scene" cols={3} narrow={narrow}>
                        <Field label="Energy" value={c.vibe.energy} onChange={(v) => setIn(entry.id, ["vibe", "energy"], v)} />
                        <Field label="Posture" value={c.vibe.posture} onChange={(v) => setIn(entry.id, ["vibe", "posture"], v)} />
                        <Field label="Resting expression" value={c.vibe.expression} onChange={(v) => setIn(entry.id, ["vibe", "expression"], v)} />
                        <Field label="Lighting" value={c.scene.lighting} onChange={(v) => setIn(entry.id, ["scene", "lighting"], v)} />
                        <Field label="Camera" value={c.scene.camera} onChange={(v) => setIn(entry.id, ["scene", "camera"], v)} />
                        <Field label="Background" value={c.scene.background} onChange={(v) => setIn(entry.id, ["scene", "background"], v)} />
                      </Group>

                      <Group title="Voice" cols={2} narrow={narrow}>
                        <Field label="Tone" value={c.voice.tone} onChange={(v) => setIn(entry.id, ["voice", "tone"], v)} />
                        <Field label="Pace" value={c.voice.pace} onChange={(v) => setIn(entry.id, ["voice", "pace"], v)} />
                        <ListField label="Says things like — one per line" items={c.voice.phrases}
                          onChange={(v) => setIn(entry.id, ["voice", "phrases"], v)} />
                        <ListField label="Never says / never does — one per line" items={c.voice.never}
                          onChange={(v) => setIn(entry.id, ["voice", "never"], v)} />
                      </Group>

                      <div style={{ marginTop: 18 }}>
                        <label style={lbl}>Backstory</label>
                        <textarea rows={3} style={ta} value={c.backstory} onChange={(e) => setIn(entry.id, ["backstory"], e.target.value)} />
                      </div>

                      <div style={{ marginTop: 18, display: "grid" }}>
                        <ListField label="Shots — one per line, each gets its own prompt below" rows={4}
                          items={c.shots} onChange={(v) => setIn(entry.id, ["shots"], v)} />
                      </div>

                      <div style={{ marginTop: 26, borderTop: `1px solid ${LINE}`, paddingTop: 6 }}>
                        <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: GOLD, marginTop: 14 }}>
                          Prompts — rebuilt live from the fields above
                        </div>

                        <PromptBox
                          label="Identity lock"
                          hint="Paste this at the top of every single generation. It is the reason the same face comes back."
                          rows={4}
                          text={identityLock(c)}
                        />
                        <PromptBox
                          label="Reference sheet — make this one first"
                          hint="Two panels, one identical person, grey studio sweep. Generate it, keep the image, and feed it back as a reference to every later shot."
                          rows={9}
                          text={sheetPrompt(c)}
                        />
                        <PromptBox
                          label="Talking head — signature outfit"
                          hint="The default content shot."
                          rows={5}
                          text={fullPrompt(c, "signature", null)}
                        />
                        {c.wardrobe.alt1 && (
                          <PromptBox label="Talking head — alternate outfit" rows={5} text={fullPrompt(c, "alt1", null)} />
                        )}
                        {(c.shots || []).filter(Boolean).map((s, i) => (
                          <PromptBox key={i} label={"Shot " + (i + 1) + " — " + s} rows={5} text={fullPrompt(c, "signature", s)} />
                        ))}
                        <PromptBox
                          label="Voice brief"
                          hint="For a voice-cloning or VO tool, and for any script written in this character's mouth."
                          rows={6}
                          text={voiceBrief(c)}
                        />
                        <PromptBox
                          label="Negative prompt"
                          hint="Paste into the negative field if your model has one. This is what kills the plastic AI look."
                          rows={4}
                          text={NEGATIVE}
                        />
                      </div>

                      <div style={{ marginTop: 26, borderTop: `1px solid ${LINE}`, paddingTop: 18 }}>
                        <label style={lbl}>Refine — say what to change in plain words</label>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <input
                            style={{ ...inp, flex: "1 1 320px" }}
                            value={entry.refineNote || ""}
                            onChange={(e) => patch(entry.id, { refineNote: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter" && !working) refine(entry); }}
                            placeholder='"a bit older", "give him glasses and a beard", "less corporate"'
                          />
                          <button style={{ ...btn, opacity: working ? 0.6 : 1, padding: "10px 20px" }} disabled={working} onClick={() => refine(entry)}>
                            {working ? "Refining…" : "Refine"}
                          </button>
                        </div>
                        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button style={ghost} onClick={() => exportOne(entry)}>Export this character</button>
                          <button style={quiet} onClick={() => duplicate(entry)}>Duplicate as variant</button>
                          {(entry.history || []).length > 0 && (
                            <button style={quiet} onClick={() => undo(entry)}>Undo refine ({entry.history.length})</button>
                          )}
                          <button style={{ ...quiet, color: "#c98a72", borderColor: "#4a2f26" }} onClick={() => remove(entry)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 40, paddingTop: 18, borderTop: `1px solid ${LINE}`, fontSize: 12.5, color: MUT, lineHeight: 1.6 }}>
          Workflow: build the character → generate the <b style={{ color: CREAM }}>reference sheet</b> first and keep that
          image → for every later shot, paste the identity lock <i>and</i> attach the sheet as a reference. That pairing is
          what holds one face across a whole content library.
        </div>
      </div>
    </div>
  );
}
