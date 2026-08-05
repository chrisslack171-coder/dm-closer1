import React, { useEffect, useRef, useState } from "react";

// GOLDMINE — niche pain point miner — PROTECTED FRONTEND
// All prompts live server-side in /api/*.js. This frontend only moves the
// user's answers and the AI's responses.

const GOLD = "#C9A227";
const GOLD2 = "#d8b552";
const INK = "#14110c";
const PANEL = "#1d1913";
const PANEL2 = "#24201a";
const LINE = "#332c20";
const CREAM = "#f4efe4";
const MUT = "#a89c84";
const DIM = "#7d735e";
const FONT = "Helvetica Neue, Arial, sans-serif";

const STAGES = [
  { key: "interview", name: "The Interview" },
  { key: "plan", name: "The Dig Site" },
  { key: "mine", name: "The Dig" },
  { key: "report", name: "The Gold" },
  { key: "build", name: "The Product" },
];

function parseJSON(t) {
  const c = (t || "").replace(/```json|```/g, "").trim();
  try { return JSON.parse(c); } catch (e) {}
  const m = c.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

function copyText(t) {
  const ta = document.createElement("textarea");
  ta.value = t;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
}

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

const btn = { background: GOLD, color: INK, border: "none", borderRadius: 8, padding: "14px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT };
const btnDis = { ...btn, opacity: 0.45, cursor: "default" };
const ghost = { background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT };
const lbl = { display: "block", fontFamily: FONT, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: MUT, marginBottom: 7 };
const inp = { width: "100%", boxSizing: "border-box", background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 8, color: CREAM, fontFamily: FONT, fontSize: 15, padding: "12px 14px", outline: "none" };
const card = { background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: "20px 22px" };
const errS = { color: "#e0a07a", fontSize: 13, marginTop: 12, fontFamily: FONT };
const h2S = { fontFamily: FONT, color: CREAM, fontSize: 26, fontWeight: 800, margin: "6px 0 8px" };
const kicker = { fontFamily: FONT, color: GOLD, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" };
const bodyS = { fontFamily: FONT, color: MUT, fontSize: 15, lineHeight: 1.55 };

export default function GoldMine() {
  const [screen, setScreen] = useState(-1); // -1 welcome, 0 interview, 1 plan, 2 mining, 3 report, 4 build
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState("");

  // interview
  const [chat, setChat] = useState([]);       // display turns {who:'coach'|'me', text}
  const [history, setHistory] = useState([]); // api messages
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  // plan (editable)
  const [plan, setPlan] = useState(null);
  const [read, setRead] = useState("");
  const [subsText, setSubsText] = useState("");
  const [redditQText, setRedditQText] = useState("");
  const [ytQText, setYtQText] = useState("");

  // mining
  const [mineStage, setMineStage] = useState("");
  const [mineDetail, setMineDetail] = useState("");
  const [mining, setMining] = useState(false);

  // report
  const [report, setReport] = useState(null);
  const [painIdx, setPainIdx] = useState(0);
  const [dataCounts, setDataCounts] = useState({ reddit: 0, youtube: 0 });

  // build
  const [buildRes, setBuildRes] = useState(null);
  const [building, setBuilding] = useState(false);

  const chatEndRef = useRef(null);
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  useEffect(() => { if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [chat, chatBusy]);

  async function api(path, payload) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, code }),
      });
      if (r.status === 401) { setNeedCode(true); throw new Error("Enter your access code to unlock GoldMine."); }
      if (r.status === 501) { const d = await r.json(); throw new Error(d.error || "Server missing a token"); }
      if (!r.ok) {
        if (r.status === 429 || r.status === 529 || r.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Error " + r.status);
      }
      setNeedCode(false);
      return r.json();
    }
    throw new Error("The engine is busy — try again in a minute.");
  }

  // ---------- interview ----------

  async function sendChat(first) {
    const text = first ? "" : chatInput.trim();
    if (!first && !text) return;
    setError("");
    setChatBusy(true);
    const msgs = first
      ? [{ role: "user", content: "Start the interview. Ask me your first question." }]
      : [...history, { role: "user", content: text }];
    if (!first) setChat((c) => [...c, { who: "me", text }]);
    setChatInput("");
    try {
      const data = await api("/api/interview", { messages: msgs });
      const p = parseJSON(data.text);
      if (!p) throw new Error("Couldn't read that — try again.");
      setHistory([...msgs, { role: "assistant", content: data.text }]);
      if (p.done && p.plan) {
        setPlan(p.plan);
        setRead(p.read || "");
        setSubsText((p.plan.subreddits || []).join(", "));
        setRedditQText((p.plan.reddit_searches || []).join(" | "));
        setYtQText((p.plan.youtube_queries || []).join(" | "));
        setChat((c) => [...c, { who: "coach", text: p.read || "Got it. I know where to dig." }]);
        setTimeout(() => setScreen(1), 900);
      } else {
        setChat((c) => [...c, { who: "coach", text: p.question }]);
      }
    } catch (e) {
      setError(e.message);
    }
    setChatBusy(false);
  }

  function startInterview() {
    setScreen(0);
    setChat([]);
    setHistory([]);
    setError("");
    sendChat(true);
  }

  // ---------- mining ----------

  function effectivePlan() {
    return {
      ...plan,
      subreddits: subsText.split(",").map((s) => s.trim().replace(/^r\//, "")).filter(Boolean).slice(0, 5),
      reddit_searches: redditQText.split("|").map((s) => s.trim()).filter(Boolean).slice(0, 3),
      youtube_queries: ytQText.split("|").map((s) => s.trim()).filter(Boolean).slice(0, 3),
    };
  }

  async function startMining() {
    const p = effectivePlan();
    setScreen(2);
    setMining(true);
    setError("");
    try {
      setMineStage("Opening the dig site");
      setMineDetail("Starting the Reddit and YouTube scrapes...");
      const runs = await api("/api/research", { action: "start", plan: p });

      setMineStage("Digging");
      const t0 = Date.now();
      let st = { reddit: "RUNNING", youtube: "RUNNING" };
      while (st.reddit !== "SUCCEEDED" || st.youtube !== "SUCCEEDED") {
        if (Date.now() - t0 > 5 * 60 * 1000) throw new Error("The scrape is taking too long — try again, or narrow the dig site.");
        if (["FAILED", "ABORTED", "TIMED-OUT"].includes(st.reddit) || ["FAILED", "ABORTED", "TIMED-OUT"].includes(st.youtube)) {
          throw new Error("A scraper run failed (Reddit: " + st.reddit + ", YouTube: " + st.youtube + "). Tap retry.");
        }
        await sleep(5000);
        st = await api("/api/research", { action: "status", reddit: runs.reddit.runId, youtube: runs.youtube.runId });
        setMineDetail(`Reddit: ${st.reddit.toLowerCase()} · YouTube: ${st.youtube.toLowerCase()} · ${Math.round((Date.now() - t0) / 1000)}s`);
      }

      setMineStage("Hauling it out");
      setMineDetail("Collecting posts, comments, and videos...");
      const data = await api("/api/research", { action: "fetch", redditDs: runs.reddit.datasetId, youtubeDs: runs.youtube.datasetId });
      setDataCounts({ reddit: data.reddit.length, youtube: data.youtube.length });

      setMineStage("Panning for gold");
      setMineDetail(`Reading ${data.reddit.length} Reddit items and ${data.youtube.length} videos for pain and trends...`);
      const an = await api("/api/analyze", { plan: p, reddit: data.reddit, youtube: data.youtube });
      const rep = parseJSON(an.text);
      if (!rep || !rep.pains || !rep.pains.length) throw new Error("Couldn't read the analysis — tap retry.");
      setReport(rep);
      setPainIdx(0);
      setMining(false);
      setScreen(3);
    } catch (e) {
      setMining(false);
      setError(e.message);
    }
  }

  // ---------- build ----------

  async function runBuild() {
    setBuilding(true);
    setError("");
    try {
      const data = await api("/api/build", { plan: effectivePlan(), pain: report.pains[painIdx], trends: report.trends || [] });
      const b = parseJSON(data.text);
      if (!b || !b.product) throw new Error("Couldn't read the build — tap retry.");
      setBuildRes(b);
      setScreen(4);
    } catch (e) {
      setError(e.message);
    }
    setBuilding(false);
  }

  function kitText() {
    if (!buildRes) return "";
    const p = buildRes.product;
    const L = [];
    L.push("GOLDMINE — MY PRODUCT + CONTENT KIT");
    L.push("========================================");
    L.push("");
    L.push("NICHE: " + (plan ? plan.niche : ""));
    L.push("PAIN POINT: " + (report ? report.pains[painIdx].pain : ""));
    L.push("");
    L.push("PRODUCT");
    L.push(`${p.title} — ${p.subtitle}`);
    L.push(`Format: ${p.format} · Suggested price: $${p.price}`);
    L.push(`Promise: ${p.promise}`);
    L.push(`Anchor: ${p.anchor}`);
    L.push("");
    L.push("OUTLINE");
    (p.outline || []).forEach((o, i) => L.push(`${i + 1}. ${o}`));
    L.push("");
    L.push("POSTS");
    (buildRes.posts || []).forEach((post, i) => {
      L.push(`--- Post ${i + 1} (${post.platform}) ---`);
      L.push("Hook: " + post.hook);
      L.push(post.script);
      L.push("CTA: " + post.cta);
      L.push("");
    });
    L.push("FIRST LINE (DM)");
    L.push(buildRes.first_line || "");
    return L.join("\n");
  }

  function downloadKit() {
    const blob = new Blob([kitText()], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "goldmine-product-content-kit.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  // ---------- render helpers ----------

  function renderCopy(text, id) {
    const done = copied === id;
    return (
      <button
        style={{ ...ghost, padding: "5px 10px", fontSize: 12, color: done ? "#7bc47f" : GOLD, borderColor: done ? "#7bc47f" : GOLD, flexShrink: 0 }}
        onClick={() => { copyText(text); setCopied(id); setTimeout(() => setCopied(""), 1400); }}
      >
        {done ? "Copied" : "Copy"}
      </button>
    );
  }

  function renderHeader() {
    return (
      <div style={{ borderBottom: `1px solid ${LINE}`, padding: "16px 20px", display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: FONT }}>
          <span style={{ color: GOLD, fontWeight: 800, fontSize: 15, letterSpacing: 2 }}>GOLDMINE</span>
          <span style={{ color: MUT, fontSize: 12, marginLeft: 10, letterSpacing: 1 }}>FIND THE PAIN. MINE THE GOLD.</span>
        </div>
        <div style={{ color: MUT, fontFamily: FONT, fontSize: 12 }}>by Chris Slack · The Digital Closer</div>
      </div>
    );
  }

  function renderStages() {
    const idx = Math.max(0, Math.min(screen, 4));
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "14px 0 4px" }}>
        {STAGES.map((s, i) => (
          <div key={s.key} style={{
            background: i === idx ? GOLD : "transparent",
            color: i === idx ? INK : i < idx ? GOLD2 : "#59503d",
            border: `1px solid ${i === idx ? GOLD : LINE}`,
            borderRadius: 20, padding: "6px 12px", fontFamily: FONT, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5,
          }}>
            {String(i + 1).padStart(2, "0")} · {s.name}
          </div>
        ))}
      </div>
    );
  }

  function renderCodeGate() {
    if (!needCode) return null;
    return (
      <div style={{ ...card, marginTop: 16, borderColor: GOLD }}>
        <label style={lbl}>Access code (from your purchase)</label>
        <input style={inp} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter your access code" />
      </div>
    );
  }

  function renderWelcome() {
    return (
      <div>
        <div style={{ marginTop: 46, marginBottom: 8 }}>
          <div style={kicker}>Live niche research · Interview → Scrape → Build</div>
          <div style={{ fontFamily: FONT, color: CREAM, fontWeight: 800, fontSize: 44, lineHeight: 1.05, margin: "10px 0" }}>
            GOLD<span style={{ color: GOLD }}>MINE</span>
          </div>
          <div style={{ ...bodyS, fontSize: 17, maxWidth: 580 }}>
            A short interview finds your niche. Then GoldMine scrapes <b style={{ color: CREAM }}>Reddit and YouTube live</b> to
            find what your buyers are actually complaining about and what content is actually trending — and turns
            the loudest pain into a digital product plus a week of ready-to-post content.
          </div>
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", margin: "26px 0" }}>
          {[
            ["01", "The Interview", "A closer's questions find your niche fast"],
            ["02", "The Dig", "Live scrape of Reddit + YouTube in your niche"],
            ["03", "The Gold", "Pain points in your buyers' exact words, ranked"],
            ["04", "The Product", "A product concept + posts — all you do is post"],
          ].map(([n, t, d]) => (
            <div key={n} style={{ ...card, padding: "16px 18px" }}>
              <div><span style={{ color: GOLD, fontFamily: FONT, fontWeight: 800, fontSize: 13 }}>{n}</span>
                <span style={{ color: CREAM, fontFamily: FONT, fontWeight: 700, fontSize: 14, marginLeft: 10 }}>{t}</span></div>
              <div style={{ ...bodyS, fontSize: 13, marginTop: 6 }}>{d}</div>
            </div>
          ))}
        </div>
        <button style={btn} onClick={startInterview}>Start the interview</button>
        <div style={{ ...bodyS, fontSize: 12.5, marginTop: 26, color: DIM }}>
          A full dig takes 2–4 minutes. Real data, not guesses.
        </div>
      </div>
    );
  }

  function renderInterview() {
    return (
      <div>
        {renderStages()}
        <div style={{ marginTop: 18 }}>
          <div style={kicker}>Stage 01</div>
          <h2 style={h2S}>The Interview</h2>
          <div style={{ ...bodyS, maxWidth: 640 }}>Answer like you'd talk to a friend. Short is fine — the questions do the work.</div>
        </div>
        <div style={{ ...card, marginTop: 18, padding: "14px 16px", minHeight: 220 }}>
          {chat.map((t, i) => (
            <div key={i} style={{ display: "flex", justifyContent: t.who === "me" ? "flex-end" : "flex-start", margin: "10px 0" }}>
              <div style={{
                maxWidth: "85%", borderRadius: 12, padding: "11px 15px", fontFamily: FONT, fontSize: 14.5, lineHeight: 1.5,
                background: t.who === "me" ? GOLD : PANEL2,
                color: t.who === "me" ? INK : CREAM,
                border: t.who === "me" ? "none" : `1px solid ${LINE}`,
              }}>{t.text}</div>
            </div>
          ))}
          {chatBusy && <div style={{ ...bodyS, fontSize: 13, color: GOLD2, margin: "10px 0" }}>reading you...</div>}
          <div ref={chatEndRef} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <input
            style={{ ...inp, flex: 1 }}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !chatBusy) sendChat(false); }}
            placeholder="Type your answer..."
          />
          <button style={chatBusy || !chatInput.trim() ? btnDis : btn} disabled={chatBusy || !chatInput.trim()} onClick={() => sendChat(false)}>Send</button>
        </div>
        {error ? <div style={errS}>{error}</div> : null}
        {renderCodeGate()}
      </div>
    );
  }

  function renderPlanField(label, value, set, ph) {
    return (
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>{label}</label>
        <input style={inp} value={value} onChange={(e) => set(e.target.value)} placeholder={ph} />
      </div>
    );
  }

  function renderPlan() {
    if (!plan) return null;
    return (
      <div>
        {renderStages()}
        <div style={{ marginTop: 18 }}>
          <div style={kicker}>Stage 02</div>
          <h2 style={h2S}>The Dig Site</h2>
          <div style={{ ...bodyS, maxWidth: 640 }}>Here's where I'd dig. Adjust anything, then start the dig — the scrape runs live and takes a couple of minutes.</div>
        </div>
        <div style={{ ...card, marginTop: 18, borderLeft: `3px solid ${GOLD}` }}>
          <div style={{ ...kicker, fontSize: 11 }}>The read</div>
          <div style={{ fontFamily: FONT, color: CREAM, fontSize: 15, marginTop: 5 }}>{read}</div>
          <div style={{ ...bodyS, fontSize: 13.5, marginTop: 10 }}>
            <b style={{ color: CREAM }}>Niche:</b> {plan.niche}<br />
            <b style={{ color: CREAM }}>Audience:</b> {plan.audience}<br />
            <b style={{ color: CREAM }}>Expected pain:</b> {plan.pain_hypothesis}
          </div>
        </div>
        <div style={{ ...card, marginTop: 14 }}>
          {renderPlanField("Subreddits (comma-separated)", subsText, setSubsText, "sidehustle, Entrepreneur")}
          {renderPlanField("Reddit searches (separate with | )", redditQText, setRedditQText, "can't get my first sale | no one buys")}
          {renderPlanField("YouTube queries (separate with | )", ytQText, setYtQText, "how to sell digital products | first sale online")}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <button style={btn} onClick={startMining}>Start the dig — scrape Reddit + YouTube</button>
          <button style={ghost} onClick={startInterview}>Redo the interview</button>
        </div>
        {error ? <div style={errS}>{error}</div> : null}
        {renderCodeGate()}
      </div>
    );
  }

  function renderMining() {
    return (
      <div>
        {renderStages()}
        <div style={{ marginTop: 18 }}>
          <div style={kicker}>Stage 03</div>
          <h2 style={h2S}>The Dig</h2>
        </div>
        <div style={{ ...card, marginTop: 18, textAlign: "center", padding: "44px 20px" }}>
          {mining ? (
            <div>
              <div style={{ color: GOLD, fontFamily: FONT, fontSize: 26, fontWeight: 800, letterSpacing: 4 }}>⛏</div>
              <div style={{ fontFamily: FONT, color: CREAM, fontSize: 18, fontWeight: 700, marginTop: 12 }}>{mineStage}</div>
              <div style={{ ...bodyS, marginTop: 8 }}>{mineDetail}</div>
              <div style={{ ...bodyS, fontSize: 12.5, marginTop: 18, color: DIM }}>Live scrape — usually 1–3 minutes. Don't close the tab.</div>
            </div>
          ) : (
            <div>
              <div style={{ ...bodyS, color: CREAM }}>The dig stopped.</div>
              {error ? <div style={errS}>{error}</div> : null}
              <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <button style={btn} onClick={startMining}>Retry the dig</button>
                <button style={ghost} onClick={() => setScreen(1)}>Back to the dig site</button>
              </div>
            </div>
          )}
        </div>
        {renderCodeGate()}
      </div>
    );
  }

  function renderHeat(h) {
    const n = Math.max(1, Math.min(10, Number(h) || 5));
    return (
      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{ width: 10, height: 8, borderRadius: 2, background: i < n ? (n >= 8 ? GOLD : GOLD2) : LINE }} />
        ))}
        <span style={{ fontFamily: FONT, color: GOLD2, fontSize: 12, fontWeight: 800, marginLeft: 6 }}>{n}/10</span>
      </div>
    );
  }

  function renderReport() {
    if (!report) return null;
    return (
      <div>
        {renderStages()}
        <div style={{ marginTop: 18 }}>
          <div style={kicker}>Stage 04 · from {dataCounts.reddit} Reddit items + {dataCounts.youtube} videos</div>
          <h2 style={h2S}>The Gold</h2>
          <div style={{ ...bodyS, maxWidth: 640 }}>These are your buyers' words, not guesses. Pick the pain to build on — the verdict has my recommendation.</div>
        </div>
        <div style={{ ...card, marginTop: 18, borderLeft: `3px solid ${GOLD}` }}>
          <div style={{ ...kicker, fontSize: 11 }}>The verdict</div>
          <div style={{ fontFamily: FONT, color: GOLD2, fontSize: 15, marginTop: 5, fontStyle: "italic" }}>{report.verdict}</div>
        </div>
        <div style={{ ...kicker, margin: "18px 0 8px" }}>Pain points, ranked by heat</div>
        <div style={{ display: "grid", gap: 10 }}>
          {report.pains.map((p, i) => (
            <div key={i} onClick={() => setPainIdx(i)} style={{ ...card, cursor: "pointer", borderColor: painIdx === i ? GOLD : LINE, background: painIdx === i ? PANEL2 : PANEL }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontFamily: FONT, color: CREAM, fontSize: 16, fontWeight: 800, flex: 1, minWidth: 200 }}>{p.pain}</div>
                {renderHeat(p.heat)}
              </div>
              <div style={{ marginTop: 10 }}>
                {(p.quotes || []).map((q, j) => (
                  <div key={j} style={{ borderLeft: `2px solid ${GOLD}`, paddingLeft: 12, margin: "8px 0", fontFamily: FONT, color: MUT, fontSize: 13.5, fontStyle: "italic" }}>"{q}"</div>
                ))}
              </div>
              <div style={{ ...bodyS, fontSize: 13.5, marginTop: 8 }}><b style={{ color: GOLD2 }}>They'd pay to feel:</b> {p.instead}</div>
            </div>
          ))}
        </div>
        <div style={{ ...kicker, margin: "20px 0 8px" }}>What's trending in your niche</div>
        <div style={{ display: "grid", gap: 10 }}>
          {(report.trends || []).map((t, i) => (
            <div key={i} style={{ ...card, padding: "14px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: FONT, color: CREAM, fontWeight: 700, fontSize: 14.5 }}>{t.pattern}</span>
                <span style={{ ...kicker, fontSize: 10.5 }}>{t.platform}</span>
              </div>
              <div style={{ ...bodyS, fontSize: 13.5, marginTop: 6 }}>{t.evidence}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <button style={building ? btnDis : btn} disabled={building} onClick={runBuild}>
            {building ? "Building..." : `Build my product on pain #${painIdx + 1}`}
          </button>
          <button style={ghost} onClick={() => setScreen(1)}>Dig somewhere else</button>
        </div>
        {error ? <div style={errS}>{error}</div> : null}
        {renderCodeGate()}
      </div>
    );
  }

  function renderBuild() {
    if (!buildRes) return null;
    const p = buildRes.product;
    return (
      <div>
        {renderStages()}
        <div style={{ marginTop: 18 }}>
          <div style={kicker}>Stage 05</div>
          <h2 style={h2S}>The Product</h2>
          <div style={{ ...bodyS, maxWidth: 640 }}>Built on real pain, modeled on what's already trending. All that's left is to build it and post.</div>
        </div>

        <div style={{ ...card, marginTop: 18, borderColor: GOLD }}>
          <div style={{ ...kicker, fontSize: 11 }}>{p.format} · suggested ${p.price}</div>
          <div style={{ fontFamily: FONT, color: CREAM, fontSize: 24, fontWeight: 800, marginTop: 6 }}>{p.title}</div>
          <div style={{ ...bodyS, fontSize: 15, marginTop: 4 }}>{p.subtitle}</div>
          <div style={{ fontFamily: FONT, color: GOLD2, fontSize: 15, marginTop: 12 }}>{p.promise}</div>
          <div style={{ ...bodyS, fontSize: 13, marginTop: 10 }}><b style={{ color: CREAM }}>Price anchor:</b> {p.anchor}</div>
          <div style={{ ...kicker, fontSize: 11, marginTop: 16, marginBottom: 6 }}>Outline</div>
          {(p.outline || []).map((o, i) => (
            <div key={i} style={{ display: "flex", gap: 12, margin: "7px 0" }}>
              <span style={{ fontFamily: FONT, color: GOLD, fontWeight: 800, fontSize: 13, minWidth: 20 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontFamily: FONT, color: CREAM, fontSize: 14 }}>{o}</span>
            </div>
          ))}
        </div>

        <div style={{ ...kicker, margin: "20px 0 8px" }}>Your posts — modeled on what's trending</div>
        <div style={{ display: "grid", gap: 10 }}>
          {(buildRes.posts || []).map((post, i) => (
            <div key={i} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ ...kicker, fontSize: 10.5 }}>{post.platform}</span>
                {renderCopy(`${post.hook}\n\n${post.script}\n\n${post.cta}`, "post" + i)}
              </div>
              <div style={{ fontFamily: FONT, color: GOLD2, fontSize: 15, fontWeight: 700, marginTop: 8 }}>{post.hook}</div>
              <div style={{ fontFamily: FONT, color: CREAM, fontSize: 14, marginTop: 8, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{post.script}</div>
              <div style={{ ...bodyS, fontSize: 13, marginTop: 8 }}><b style={{ color: GOLD2 }}>CTA:</b> {post.cta}</div>
            </div>
          ))}
        </div>

        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ ...kicker, fontSize: 11 }}>Your first line (DM)</div>
              <div style={{ fontFamily: FONT, color: CREAM, fontSize: 14.5, marginTop: 6 }}>{buildRes.first_line}</div>
            </div>
            {renderCopy(buildRes.first_line || "", "fl")}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <button style={btn} onClick={downloadKit}>Download the full kit</button>
          <button style={ghost} onClick={() => setScreen(3)}>Back to the gold</button>
          <button style={ghost} onClick={runBuild}>Rebuild</button>
        </div>

        <div style={{ ...bodyS, fontSize: 12, margin: "18px 0 30px", color: DIM }}>
          This tool is for educational purposes only. Results are estimates based on scraped public data and the information you provided, and do not account for your full financial situation. Consult a qualified financial professional before making investment or business decisions.
        </div>
        {error ? <div style={errS}>{error}</div> : null}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: INK }}>
      {renderHeader()}
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "8px 20px 60px" }}>
        {screen === -1 && renderWelcome()}
        {screen === 0 && renderInterview()}
        {screen === 1 && renderPlan()}
        {screen === 2 && renderMining()}
        {screen === 3 && renderReport()}
        {screen === 4 && renderBuild()}
      </div>
      <div style={{ borderTop: `1px solid ${LINE}`, padding: "14px 20px", textAlign: "center", fontFamily: FONT, fontSize: 11.5, color: DIM }}>
        GOLDMINE · Obvious-to-you is gold-to-them · © Chris Slack
      </div>
    </div>
  );
}
