import React, { useState, useEffect } from "react";

// VIRAL FLIPPER — batch pipeline, protected frontend.
// Paste saved Instagram post/reel URLs -> server extracts video + transcript
// (/api/extract) -> server flips each script into YOUR voice (/api/flip) ->
// export a CSV (competitor script + your script) ready for HeyGen bulk /
// batch faceless-video creation. No API keys ever touch this file.

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

function csvCell(v) {
  const s = String(v == null ? "" : v);
  return '"' + s.replace(/"/g, '""') + '"';
}

function buildCSV(rows) {
  const header = ["title", "competitor_handle", "source_url", "hook_type", "competitor_script", "my_script"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      csvCell(r.title), csvCell(r.username ? "@" + r.username : ""), csvCell(r.url),
      csvCell(r.hookType), csvCell(r.transcript), csvCell(r.myScript),
    ].join(","));
  }
  return lines.join("\r\n");
}

export default function ViralFlipper() {
  const [voice, setVoice] = useState("");
  const [urls, setUrls] = useState("");
  const [rows, setRows] = useState([]); // {id,url,status,username,transcript,caption,title,hookType,myScript,error}
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("vf_voice");
    if (saved) setVoice(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("vf_voice", voice);
  }, [voice]);

  const patch = (id, p) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  async function processRow(row, voiceProfile) {
    try {
      patch(row.id, { status: "extracting", error: "" });
      const ex = await post("/api/extract", { url: row.url });
      patch(row.id, { status: "flipping", username: ex.username, transcript: ex.transcript, caption: ex.caption });
      const fl = await post("/api/flip", {
        transcript: ex.transcript, caption: ex.caption, username: ex.username, voiceProfile,
      });
      const j = parseJSON(fl.text, {});
      patch(row.id, {
        status: "done",
        title: j.title || "Untitled",
        hookType: j.hook_type || "",
        myScript: j.script || fl.text,
      });
    } catch (e) {
      patch(row.id, { status: "error", error: e.message || "failed" });
    }
  }

  async function run() {
    if (!voice.trim()) { alert("Fill in your voice profile first — that's what makes the flip YOURS."); return; }
    const list = urls.split("\n").map((s) => s.trim()).filter((s) => s.includes("instagram.com"));
    if (!list.length) { alert("Paste at least one instagram.com post/reel URL (one per line)."); return; }

    const fresh = list.map((u, i) => ({
      id: Date.now() + "_" + i, url: u, status: "queued",
      username: "", transcript: "", caption: "", title: "", hookType: "", myScript: "", error: "",
    }));
    setRows((rs) => [...rs.filter((r) => r.status === "done"), ...fresh]);
    setRunning(true);

    // simple worker pool
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

  async function retry(row) {
    await processRow(row, voice);
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

  const doneCount = rows.filter((r) => r.status === "done").length;

  return (
    <div style={{ minHeight: "100vh", background: INK, color: CREAM, fontFamily: "Helvetica Neue, Arial, sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>The Digital Closer</div>
        <h1 style={{ fontSize: 32, margin: "0 0 4px" }}>Viral Flipper</h1>
        <p style={{ color: MUT, marginTop: 0, maxWidth: 720 }}>
          Paste saved Instagram reels. It pulls the video's script, flips it into <b style={{ color: CREAM }}>your</b> voice
          (same viral structure, your positioning), and exports a CSV — competitor script beside yours — ready for
          HeyGen bulk voice + faceless video creation.
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
            <label style={lbl}>2 · Saved post URLs — one per line</label>
            <textarea rows={9} style={ta} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder={"https://www.instagram.com/reel/ABC123.../\nhttps://www.instagram.com/reel/XYZ789.../"} />
            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <button style={{ ...btn, opacity: running ? 0.6 : 1 }} disabled={running} onClick={run}>
                {running ? "Working…" : "Extract & Flip"}
              </button>
              <button style={ghost} onClick={exportCSV} disabled={!doneCount}>
                Export CSV ({doneCount})
              </button>
            </div>
          </div>
        </div>

        {rows.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <label style={lbl}>3 · Results — edit anything before export</label>
            {rows.map((r) => (
              <div key={r.id} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontSize: 13, color: MUT, wordBreak: "break-all" }}>
                    {r.username ? <b style={{ color: GOLD }}>@{r.username}</b> : null} {r.url}
                  </div>
                  <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: r.status === "done" ? "#7bc47f" : r.status === "error" ? "#e0a07a" : GOLD }}>
                    {r.status}{r.error ? " — " + r.error : ""}
                    {r.status === "error" && (
                      <button style={{ ...ghost, marginLeft: 10, padding: "4px 10px", fontSize: 12 }} onClick={() => retry(r)}>Retry</button>
                    )}
                  </div>
                </div>
                {(r.transcript || r.myScript) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
                    <div>
                      <label style={lbl}>Their script (as spoken)</label>
                      <textarea rows={7} style={ta} value={r.transcript} onChange={(e) => patch(r.id, { transcript: e.target.value })} />
                    </div>
                    <div>
                      <label style={lbl}>
                        Your script{r.title ? " — " + r.title : ""}{r.hookType ? " · " + r.hookType : ""}
                      </label>
                      <textarea rows={7} style={ta} value={r.myScript} onChange={(e) => patch(r.id, { myScript: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p style={{ color: MUT, fontSize: 13, marginTop: 30, maxWidth: 760 }}>
          CSV columns: title · competitor_handle · source_url · hook_type · competitor_script · my_script.
          In HeyGen: create one faceless template with a {"{{my_script}}"} variable, pick your cloned voice,
          then Bulk Create → upload this CSV → it renders one video per row.
        </p>
      </div>
    </div>
  );
}
