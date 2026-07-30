import React, { useState, useEffect, useRef } from "react";

// VIRAL FLIPPER — batch pipeline, protected frontend.
// Paste Instagram / TikTok / YouTube (or direct .mp4) URLs -> server extracts
// the spoken script (/api/extract) -> server reverse-engineers the viral
// blueprint AND flips each script into YOUR voice (/api/flip) -> remix any
// result with custom instructions (every version saved) -> export a CSV
// (competitor script + your script) ready for HeyGen bulk faceless videos.
// Your library persists on this device. No API keys ever touch this file.

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

const CONCURRENCY = 2; // parallel extractions; raise once you trust your quotas

const btn = { background: GOLD, color: INK, border: "none", borderRadius: 8, padding: "13px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "Helvetica Neue, Arial, sans-serif" };
const ghost = { background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Helvetica Neue, Arial, sans-serif" };
const lbl = { display: "block", fontFamily: "Helvetica Neue, Arial, sans-serif", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: MUT, marginBottom: 7 };
const ta = { width: "100%", boxSizing: "border-box", background: PANEL2, color: CREAM, border: `1px solid ${LINE}`, borderRadius: 8, padding: 12, fontSize: 14, fontFamily: "Helvetica Neue, Arial, sans-serif", resize: "vertical" };
const chip = { display: "inline-block", background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 999, padding: "4px 12px", fontSize: 12, color: CREAM, marginRight: 8, marginBottom: 6 };

const VOICE_EXAMPLE = `Who I am: sales coach, 1,000+ closes, started door-to-door.
Niche: coaches & course creators who can't close DMs into sales.
Offer: The Digital Closer (my DM closing system).
Tone: calm, low, direct, in control. Shoot straight from the hip. Serve, don't chase.
Phrases I use: "let's pull the bandaid", "first one to talk loses", "read the room".
Never: hype, income claims, fake urgency, emojis, "guys".`;

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
  const m = c.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return fb;
}

function fmtCount(n) {
  if (n == null) return null;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function csvCell(v) {
  const s = String(v == null ? "" : v);
  return '"' + s.replace(/"/g, '""') + '"';
}

function buildCSV(rows) {
  const header = ["title", "platform", "competitor_handle", "source_url", "views", "hook_type", "tone", "cta", "competitor_script", "my_script"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const bp = r.blueprint || {};
    const cur = (r.versions && r.versions[r.vIdx]) || {};
    lines.push([
      csvCell(r.title), csvCell(r.platform), csvCell(r.username ? "@" + r.username : ""),
      csvCell(r.url), csvCell(r.playCount), csvCell(bp.hook_type), csvCell(bp.tone),
      csvCell(bp.cta), csvCell(r.transcript), csvCell(cur.script),
    ].join(","));
  }
  return lines.join("\r\n");
}

const FRESH = (u, i) => ({
  id: Date.now() + "_" + i, url: u, platform: "", status: "queued",
  username: "", transcript: "", caption: "", coverUrl: "", playCount: null, likes: null,
  title: "", blueprint: null, why: "", versions: [], vIdx: 0, remixNote: "", error: "",
});

export default function ViralFlipper() {
  const [voice, setVoice] = useState("");
  const [urls, setUrls] = useState("");
  const [rows, setRows] = useState([]);
  const [running, setRunning] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("vf_voice");
      if (v) setVoice(v);
      const lib = JSON.parse(localStorage.getItem("vf_library") || "[]");
      if (Array.isArray(lib)) setRows(lib.map((r) => (r.status === "done" ? r : { ...r, status: "error", error: r.error || "interrupted" })));
    } catch (e) {}
    loaded.current = true;
  }, []);
  useEffect(() => { if (loaded.current) localStorage.setItem("vf_voice", voice); }, [voice]);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem("vf_library", JSON.stringify(rows)); } catch (e) {}
  }, [rows]);

  const patch = (id, p) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...(typeof p === "function" ? p(r) : p) } : r)));

  async function processRow(row, voiceProfile) {
    try {
      patch(row.id, { status: "extracting", error: "" });
      const ex = await post("/api/extract", { url: row.url });
      patch(row.id, {
        status: "flipping", platform: ex.platform, username: ex.username,
        transcript: ex.transcript, caption: ex.caption, coverUrl: ex.coverUrl || "",
        playCount: ex.playCount, likes: ex.likes,
      });
      const fl = await post("/api/flip", {
        transcript: ex.transcript, caption: ex.caption, username: ex.username,
        coverUrl: ex.coverUrl || undefined, voiceProfile,
      });
      const j = parseJSON(fl.text, {});
      patch(row.id, {
        status: "done",
        title: j.title || "Untitled",
        blueprint: j.blueprint || null,
        why: j.why_it_worked || "",
        versions: [{ script: j.script || fl.text, note: "original flip" }],
        vIdx: 0,
      });
    } catch (e) {
      patch(row.id, { status: "error", error: e.message || "failed" });
    }
  }

  async function run() {
    if (!voice.trim()) { alert("Fill in your voice profile first — that's what makes the flip YOURS."); return; }
    const list = urls.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!list.length) { alert("Paste at least one video URL (one per line)."); return; }
    const fresh = list.map(FRESH);
    setRows((rs) => [...rs.filter((r) => r.status === "done"), ...fresh]);
    setUrls("");
    setRunning(true);
    let idx = 0;
    const worker = async () => {
      while (idx < fresh.length) {
        const row = fresh[idx++];
        await processRow(row, voice);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, fresh.length) }, worker));
    setRunning(false);
  }

  async function remix(row) {
    const note = (row.remixNote || "").trim();
    if (!note) { alert('Tell it what to change — e.g. "make it funnier" or "shorten to 30s".'); return; }
    const cur = row.versions[row.vIdx];
    patch(row.id, { status: "remixing" });
    try {
      const fl = await post("/api/flip", {
        transcript: row.transcript, caption: row.caption, username: row.username,
        voiceProfile: voice, previousScript: cur ? cur.script : "", instructions: note,
      });
      const j = parseJSON(fl.text, {});
      patch(row.id, (r) => ({
        status: "done", remixNote: "",
        versions: [...r.versions, { script: j.script || fl.text, note }],
        vIdx: r.versions.length,
        blueprint: j.blueprint || r.blueprint,
        title: j.title || r.title,
      }));
    } catch (e) {
      patch(row.id, { status: "done", error: "" });
      alert("Remix failed: " + (e.message || "unknown"));
    }
  }

  function exportCSV() {
    const done = rows.filter((r) => r.status === "done");
    if (!done.length) { alert("Nothing finished yet."); return; }
    const blob = new Blob([buildCSV(done)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "flipped-scripts.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function clearLibrary() {
    if (confirm("Clear your whole library? The CSV is your backup — export first if you need it.")) setRows([]);
  }

  const doneCount = rows.filter((r) => r.status === "done").length;

  return (
    <div style={{ minHeight: "100vh", background: INK, color: CREAM, fontFamily: "Helvetica Neue, Arial, sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>The Digital Closer</div>
        <h1 style={{ fontSize: 32, margin: "0 0 4px" }}>Viral Flipper</h1>
        <p style={{ color: MUT, marginTop: 0, maxWidth: 740 }}>
          Paste viral videos — Instagram, TikTok, YouTube, or a direct file link. It pulls each script, reverse-engineers
          the <b style={{ color: CREAM }}>blueprint</b> (hook, structure, pacing, CTA), flips it into <b style={{ color: CREAM }}>your</b> voice,
          lets you remix every result, and exports a CSV ready for HeyGen bulk voice + faceless-video creation.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 24 }}>
          <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
            <label style={lbl}>1 · Your voice profile (saved on this device)</label>
            <textarea rows={9} style={ta} value={voice} onChange={(e) => setVoice(e.target.value)} placeholder={VOICE_EXAMPLE} />
            {!voice && (
              <button style={{ ...ghost, marginTop: 10 }} onClick={() => setVoice(VOICE_EXAMPLE)}>Use example as starting point</button>
            )}
          </div>
          <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
            <label style={lbl}>2 · Video URLs — one per line, any platform</label>
            <textarea rows={9} style={ta} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder={"https://www.instagram.com/reel/ABC123.../\nhttps://www.tiktok.com/@handle/video/123456\nhttps://www.youtube.com/shorts/XYZ789"} />
            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button style={{ ...btn, opacity: running ? 0.6 : 1 }} disabled={running} onClick={run}>
                {running ? "Working…" : "Extract & Flip"}
              </button>
              <button style={ghost} onClick={exportCSV} disabled={!doneCount}>Export CSV ({doneCount})</button>
              {rows.length > 0 && <button style={{ ...ghost, borderColor: LINE, color: MUT }} onClick={clearLibrary}>Clear library</button>}
            </div>
          </div>
        </div>

        {rows.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <label style={lbl}>3 · Library — {doneCount} flipped · edit anything before export</label>
            {rows.map((r) => {
              const bp = r.blueprint || {};
              const cur = r.versions[r.vIdx] || { script: "" };
              return (
                <div key={r.id} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontSize: 13, color: MUT, wordBreak: "break-all" }}>
                      {r.username ? <b style={{ color: GOLD }}>@{r.username}</b> : null}
                      {r.platform ? <span style={{ textTransform: "uppercase", letterSpacing: 1, fontSize: 11, marginLeft: 8 }}>{r.platform}</span> : null}
                      {r.playCount != null && <span style={{ marginLeft: 8, color: CREAM }}>{fmtCount(r.playCount)} views</span>}
                      {r.likes != null && <span style={{ marginLeft: 8 }}>{fmtCount(r.likes)} likes</span>}
                      <span style={{ marginLeft: 8 }}>{r.url}</span>
                    </div>
                    <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: r.status === "done" ? "#7bc47f" : r.status === "error" ? "#e0a07a" : GOLD }}>
                      {r.status}{r.error ? " — " + r.error : ""}
                      {r.status === "error" && (
                        <button style={{ ...ghost, marginLeft: 10, padding: "4px 10px", fontSize: 12 }} onClick={() => processRow(r, voice)}>Retry</button>
                      )}
                    </div>
                  </div>

                  {r.blueprint && (
                    <div style={{ marginTop: 12 }}>
                      <div>
                        {bp.hook_type && <span style={chip}><b style={{ color: GOLD }}>hook</b> {bp.hook_type}</span>}
                        {bp.tone && <span style={chip}><b style={{ color: GOLD }}>tone</b> {bp.tone}</span>}
                        {bp.pacing && <span style={chip}><b style={{ color: GOLD }}>pacing</b> {bp.pacing}</span>}
                        {bp.cta && <span style={chip}><b style={{ color: GOLD }}>cta</b> {bp.cta}</span>}
                      </div>
                      {Array.isArray(bp.structure) && bp.structure.length > 0 && (
                        <div style={{ fontSize: 13, color: MUT, marginTop: 6 }}>
                          {bp.structure.map((b, i) => <span key={i}>{i > 0 && <span style={{ color: GOLD }}> → </span>}{b}</span>)}
                        </div>
                      )}
                      {r.why && <div style={{ fontSize: 13, color: CREAM, marginTop: 6, fontStyle: "italic" }}>Why it worked: {r.why}</div>}
                    </div>
                  )}

                  {(r.transcript || cur.script) && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
                      <div>
                        <label style={lbl}>Their script (as spoken)</label>
                        <textarea rows={7} style={ta} value={r.transcript} onChange={(e) => patch(r.id, { transcript: e.target.value })} />
                      </div>
                      <div>
                        <label style={lbl}>Your script{r.title ? " — " + r.title : ""}</label>
                        {r.versions.length > 1 && (
                          <div style={{ marginBottom: 6 }}>
                            {r.versions.map((v, i) => (
                              <button key={i} title={v.note}
                                style={{ ...ghost, padding: "3px 10px", fontSize: 12, marginRight: 6, background: i === r.vIdx ? GOLD : "transparent", color: i === r.vIdx ? INK : GOLD }}
                                onClick={() => patch(r.id, { vIdx: i })}>v{i + 1}</button>
                            ))}
                          </div>
                        )}
                        <textarea rows={7} style={ta} value={cur.script}
                          onChange={(e) => patch(r.id, (row) => ({ versions: row.versions.map((v, i) => (i === row.vIdx ? { ...v, script: e.target.value } : v)) }))} />
                        {r.status === "done" && (
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <input style={{ ...ta, padding: "8px 12px", flex: 1 }} placeholder='Remix: "make it funnier", "shorten to 30s"...'
                              value={r.remixNote || ""} onChange={(e) => patch(r.id, { remixNote: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") remix(r); }} />
                            <button style={ghost} onClick={() => remix(r)}>Remix</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p style={{ color: MUT, fontSize: 13, marginTop: 30, maxWidth: 760 }}>
          CSV columns: title · platform · competitor_handle · source_url · views · hook_type · tone · cta ·
          competitor_script · my_script. In HeyGen: one faceless template with a {"{{my_script}}"} variable +
          your cloned voice → Bulk Create → upload this CSV → one video per row.
        </p>
      </div>
    </div>
  );
}
