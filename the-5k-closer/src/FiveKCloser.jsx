import React, { useEffect, useState } from "react";

// THE $5K CLOSER — INTERACTIVE PLAYBOOK — PROTECTED FRONTEND
// The methodology prompt lives on the server in /api/closer.js and is NEVER
// present in this file. This frontend only sends the buyer's inputs and
// receives the AI's response.

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

// Same-origin when frontend + api are on one Vercel project.
const API_URL = "/api/closer";

const STEPS = [
  { n: "01", name: "The Shift" },
  { n: "02", name: "Mine Your Knowledge" },
  { n: "03", name: "Position It" },
  { n: "04", name: "The Math" },
  { n: "05", name: "The First Line" },
  { n: "06", name: "7-Day Launch" },
];

const LOADING_LINES = [
  "Reading your answers like a closer reads a door...",
  "Working the angles...",
  "Finding the transformation, not the information...",
  "Sharpening the promise...",
];

function parseJSON(t) {
  const c = (t || "").replace(/```json|```/g, "").trim();
  try { return JSON.parse(c); } catch (e) {}
  const m = c.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

function copyToClipboard(t) {
  const ta = document.createElement("textarea");
  ta.value = t;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
}

const btn = { background: GOLD, color: INK, border: "none", borderRadius: 8, padding: "14px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT };
const btnDis = { ...btn, opacity: 0.45, cursor: "default" };
const ghost = { background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT };
const lbl = { display: "block", fontFamily: FONT, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: MUT, marginBottom: 7 };
const inp = { width: "100%", boxSizing: "border-box", background: PANEL2, border: `1px solid ${LINE}`, borderRadius: 8, color: CREAM, fontFamily: FONT, fontSize: 15, padding: "12px 14px", outline: "none" };
const card = { background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: "20px 22px" };
const errS = { color: "#e0a07a", fontSize: 13, marginTop: 12, fontFamily: FONT };
const h2S = { fontFamily: FONT, color: CREAM, fontSize: 26, fontWeight: 800, margin: "6px 0 8px" };
const kicker = { fontFamily: FONT, color: GOLD, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" };
const body = { fontFamily: FONT, color: MUT, fontSize: 15, lineHeight: 1.55 };

const VERDICT_COLOR = { PASS: "#7bc47f", LEAN: GOLD2, RISK: "#e0a07a" };

export default function FiveKCloser() {
  const [screen, setScreen] = useState(-1); // -1 welcome, 0..5 steps
  const [maxDone, setMaxDone] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [loadLine, setLoadLine] = useState(LOADING_LINES[0]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  // access gate (only appears if the server has ACCESS_CODE set)
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState("");

  // step 1
  const [know, setKnow] = useState("");
  const [helped, setHelped] = useState("");
  const [result, setResult] = useState("");
  const [promiseRes, setPromiseRes] = useState(null);
  const [promiseIdx, setPromiseIdx] = useState(0);

  // step 2
  const [ask, setAsk] = useState("");
  const [hardway, setHardway] = useState("");
  const [faster, setFaster] = useState("");
  const [lived, setLived] = useState("");
  const [mineRes, setMineRes] = useState(null);
  const [ideaIdx, setIdeaIdx] = useState(0);

  // step 3
  const [posRes, setPosRes] = useState(null);
  const [titleIdx, setTitleIdx] = useState(0);

  // step 4
  const [price, setPrice] = useState(27);
  const [customPrice, setCustomPrice] = useState("");

  // step 5
  const [flRes, setFlRes] = useState(null);
  const [lineIdx, setLineIdx] = useState(0);

  // step 6
  const [launchRes, setLaunchRes] = useState(null);

  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  useEffect(() => {
    if (!loading) return;
    let i = 0;
    const t = setInterval(() => { i = (i + 1) % LOADING_LINES.length; setLoadLine(LOADING_LINES[i]); }, 2200);
    return () => clearInterval(t);
  }, [loading]);

  const chosenPromise = promiseRes ? (promiseRes.options[promiseIdx] || promiseRes.options[0]).sentence : "";
  const chosenIdea = mineRes ? mineRes.ideas[ideaIdx] || mineRes.ideas[0] : null;
  const chosenTitle = posRes ? posRes.titles[titleIdx] || posRes.titles[0] : "";
  const effPrice = Math.max(1, Number(customPrice) > 0 ? Number(customPrice) : price);
  const salesNeeded = Math.ceil(5000 / effPrice);
  const perDayNum = salesNeeded / 30;
  const perDay = perDayNum <= 1.05 ? "about 1 a day" : perDayNum < 2 ? "under 2 a day" : `${Math.floor(perDayNum)}–${Math.ceil(perDayNum)} a day`;
  const chosenLine = flRes ? flRes.dms[lineIdx] || flRes.dms[0] : null;

  async function callEngine(step, payload) {
    setLoading(true);
    setError("");
    let lastErr = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step, payload, code }),
        });
        if (r.status === 401) {
          setNeedCode(true);
          setLoading(false);
          setError("Enter the access code from your purchase to unlock the playbook.");
          return null;
        }
        if (!r.ok) {
          if (r.status === 429 || r.status === 529 || r.status >= 500) {
            lastErr = "AI busy (" + r.status + ")";
            await new Promise((s) => setTimeout(s, 1500 * (attempt + 1)));
            continue;
          }
          throw new Error("Error " + r.status);
        }
        const data = await r.json();
        const p = parseJSON(data.text || "");
        if (!p) { lastErr = "Couldn't read the response"; continue; }
        setLoading(false);
        setNeedCode(false);
        return p;
      } catch (e) {
        lastErr = e.message || "network error";
        await new Promise((s) => setTimeout(s, 1000 * (attempt + 1)));
      }
    }
    setLoading(false);
    setError("Couldn't reach the engine (" + lastErr + "). Tap the button to retry.");
    return null;
  }

  function advance(to) {
    setMaxDone((m) => Math.max(m, to - 1));
    setScreen(to);
    setError("");
  }

  async function genPromise() {
    const p = await callEngine("promise", { know, helped, result });
    if (p && p.options && p.options.length) {
      setPromiseRes(p);
      setPromiseIdx(typeof p.pick === "number" && p.options[p.pick] ? p.pick : 0);
    }
  }
  async function genMine() {
    const p = await callEngine("mine", { promise: chosenPromise, ask, hardway, faster, lived });
    if (p && p.ideas && p.ideas.length) { setMineRes(p); setIdeaIdx(0); }
  }
  async function genPosition() {
    const p = await callEngine("position", { promise: chosenPromise, idea: chosenIdea });
    if (p && p.titles && p.titles.length) { setPosRes(p); setTitleIdx(0); }
  }
  async function genFirstLine() {
    const p = await callEngine("firstline", { promise: chosenPromise, idea: chosenIdea, price: effPrice });
    if (p && p.dms && p.dms.length) { setFlRes(p); setLineIdx(0); }
  }
  async function genLaunch() {
    const p = await callEngine("launch", {
      promise: chosenPromise, idea: chosenIdea, price: effPrice,
      salesNeeded: String(salesNeeded), perDay, title: chosenTitle,
      firstLine: chosenLine ? chosenLine.text : "",
    });
    if (p && p.days && p.days.length) { setLaunchRes(p); advance(5); }
  }

  function kitText() {
    const L = [];
    L.push("THE $5K CLOSER — MY LAUNCH KIT");
    L.push("========================================");
    L.push("");
    L.push("MY ONE-SENTENCE PROMISE");
    L.push(chosenPromise);
    L.push("");
    if (chosenIdea) {
      L.push("MY PRODUCT");
      L.push(`${chosenTitle || chosenIdea.title} — ${chosenIdea.format || ""}`);
      if (posRes) { L.push(`Subtitle: ${posRes.subtitle}`); L.push(`Page-one promise: ${posRes.page_one_promise}`); }
      L.push("");
    }
    L.push("MY MATH");
    L.push(`Price: $${effPrice} · ~${salesNeeded} sales to $5K · ${perDay} for a month`);
    L.push("");
    if (flRes) {
      L.push("MY FIRST LINES");
      flRes.dms.forEach((d) => L.push(`[${d.play}] ${d.text}`));
      L.push("");
      L.push("CONTENT HOOKS");
      flRes.hooks.forEach((h) => L.push(`- ${h}`));
      L.push("");
    }
    if (launchRes) {
      L.push("MY 7-DAY LAUNCH");
      launchRes.days.forEach((d) => L.push(`Day ${d.day} — ${d.title}: ${d.task}`));
      L.push("");
      L.push(`Daily floor: ${launchRes.floor}`);
      L.push("");
      L.push(launchRes.sendoff);
    }
    return L.join("\n");
  }

  function downloadKit() {
    const blob = new Blob([kitText()], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-5k-closer-launch-kit.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  // ---------- render helpers (plain functions, NOT components — keeps input focus) ----------

  function renderCopyBtn(text, id, small) {
    const done = copied === id;
    return (
      <button
        style={{ ...ghost, padding: small ? "5px 10px" : "8px 14px", fontSize: 12, color: done ? "#7bc47f" : GOLD, borderColor: done ? "#7bc47f" : GOLD, flexShrink: 0 }}
        onClick={() => { copyToClipboard(text); setCopied(id); setTimeout(() => setCopied(""), 1400); }}
      >
        {done ? "Copied" : "Copy"}
      </button>
    );
  }

  function renderHeader() {
    return (
      <div style={{ borderBottom: `1px solid ${LINE}`, padding: "16px 20px", display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: FONT }}>
          <span style={{ color: GOLD, fontWeight: 800, fontSize: 15, letterSpacing: 2 }}>THE $5K CLOSER</span>
          <span style={{ color: MUT, fontSize: 12, marginLeft: 10, letterSpacing: 1 }}>INTERACTIVE PLAYBOOK</span>
        </div>
        <div style={{ color: MUT, fontFamily: FONT, fontSize: 12 }}>Chris Slack · Golden Door Award Winner</div>
      </div>
    );
  }

  function renderStepper() {
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "14px 0 4px" }}>
        {STEPS.map((s, i) => {
          const reachable = i <= maxDone + 1;
          const active = i === screen;
          return (
            <button
              key={s.n}
              onClick={() => reachable && setScreen(i)}
              style={{
                background: active ? GOLD : "transparent",
                color: active ? INK : reachable ? GOLD2 : "#59503d",
                border: `1px solid ${active ? GOLD : LINE}`,
                borderRadius: 20, padding: "6px 12px", fontFamily: FONT, fontSize: 11.5, fontWeight: 700,
                letterSpacing: 0.5, cursor: reachable ? "pointer" : "default", opacity: reachable ? 1 : 0.5,
              }}
            >
              {s.n} · {s.name}
            </button>
          );
        })}
      </div>
    );
  }

  function renderLoading() {
    return (
      <div style={{ ...card, marginTop: 18, textAlign: "center", padding: "34px 20px" }}>
        <div style={{ color: GOLD, fontFamily: FONT, fontSize: 22, fontWeight: 800, letterSpacing: 3 }}>■ ■ ■</div>
        <div style={{ ...body, marginTop: 12, color: CREAM }}>{loadLine}</div>
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

  function renderField(label, value, set, ph) {
    return (
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>{label}</label>
        <textarea style={{ ...inp, resize: "vertical" }} rows={2} value={value} onChange={(e) => set(e.target.value)} placeholder={ph} />
      </div>
    );
  }

  function renderContextCard(label, main, sub) {
    return (
      <div style={{ ...card, marginBottom: 14, borderLeft: `3px solid ${GOLD}` }}>
        <div style={{ ...kicker, fontSize: 11 }}>{label}</div>
        <div style={{ fontFamily: FONT, color: CREAM, fontSize: 15, marginTop: 5, fontWeight: 700 }}>{main}</div>
        {sub ? <div style={{ ...body, fontSize: 13.5, marginTop: 3 }}>{sub}</div> : null}
      </div>
    );
  }

  function stepShell(i, intro, children) {
    return (
      <div>
        {renderStepper()}
        <div style={{ marginTop: 18 }}>
          <div style={kicker}>Step {STEPS[i].n}</div>
          <h2 style={h2S}>{STEPS[i].name}</h2>
          <div style={{ ...body, maxWidth: 640 }}>{intro}</div>
        </div>
        <div style={{ marginTop: 20 }}>{children}</div>
        {error ? <div style={errS}>{error}</div> : null}
        {renderCodeGate()}
      </div>
    );
  }

  // ---------- screens ----------

  function renderWelcome() {
    return (
      <div>
        <div style={{ marginTop: 46, marginBottom: 8 }}>
          <div style={kicker}>The Closer's Playbook · Interactive</div>
          <div style={{ fontFamily: FONT, color: CREAM, fontWeight: 800, fontSize: 44, lineHeight: 1.05, margin: "10px 0" }}>
            THE <span style={{ color: GOLD }}>$5K</span><br />CLOSER
          </div>
          <div style={{ ...body, fontSize: 17, maxWidth: 560 }}>
            Turn what you already know into a digital product — and learn to sell it the way a closer does.
            Six steps. A few honest answers from you. The engine does the heavy lifting.
          </div>
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", margin: "26px 0" }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ ...card, padding: "14px 16px" }}>
              <span style={{ color: GOLD, fontFamily: FONT, fontWeight: 800, fontSize: 13 }}>{s.n}</span>
              <span style={{ color: CREAM, fontFamily: FONT, fontWeight: 700, fontSize: 14, marginLeft: 10 }}>{s.name}</span>
            </div>
          ))}
        </div>
        <button style={btn} onClick={() => advance(0)}>Start Step 01 — The Shift</button>
        <div style={{ ...body, fontSize: 12.5, marginTop: 26, color: DIM }}>
          From 1,032 doors closed to your first dollar online. · You'll finish with your complete Launch Kit.
        </div>
      </div>
    );
  }

  function renderStep1() {
    const ready = know.trim() && helped.trim() && result.trim();
    return stepShell(0,
      <span>Nobody buys information — they buy a clear transformation they believe they can achieve. Answer three questions and the engine runs the <b style={{ color: CREAM }}>One-Sentence Test</b> for you: "This helps ___ go from ___ to ___."</span>,
      <div>
        {!promiseRes && !loading && (
          <div style={card}>
            {renderField("What do you know or do well?", know, setKnow, "e.g. door-to-door sales, meal prep for busy parents, editing short-form video")}
            {renderField("Who have you helped — or who could you help?", helped, setHelped, "e.g. new sales reps, moms with no time to cook, small creators")}
            {renderField("What result can you genuinely get someone?", result, setResult, "e.g. close their first deal, a week of dinners in 2 hours, first 1,000 followers")}
            <button style={ready ? btn : btnDis} disabled={!ready} onClick={genPromise}>Run the One-Sentence Test</button>
          </div>
        )}
        {loading && renderLoading()}
        {promiseRes && !loading && (
          <div>
            <div style={{ ...body, marginBottom: 12 }}>Pick the promise that feels most true. <span style={{ color: GOLD2 }}>{promiseRes.why}</span></div>
            <div style={{ display: "grid", gap: 10 }}>
              {promiseRes.options.map((o, i) => (
                <div key={i} onClick={() => setPromiseIdx(i)} style={{ ...card, cursor: "pointer", borderColor: promiseIdx === i ? GOLD : LINE, background: promiseIdx === i ? PANEL2 : PANEL }}>
                  <div style={{ ...kicker, fontSize: 11 }}>{o.angle}{promiseRes.pick === i ? " · Chris's pick" : ""}</div>
                  <div style={{ fontFamily: FONT, color: CREAM, fontSize: 16.5, fontWeight: 600, marginTop: 6, lineHeight: 1.4 }}>{o.sentence}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <button style={btn} onClick={() => advance(1)}>Lock it in — Step 02</button>
              <button style={ghost} onClick={() => setPromiseRes(null)}>Edit my answers</button>
              <button style={ghost} onClick={genPromise}>Regenerate</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderStep2() {
    const ready = ask.trim() && hardway.trim() && faster.trim() && lived.trim();
    return stepShell(1,
      <span>You don't need a new skill — you need to package one you already have. <b style={{ color: CREAM }}>Obvious-to-you is gold-to-them.</b> Answer the four questions honestly and the engine turns them into product ideas you can build in days.</span>,
      <div>
        {renderContextCard("Your locked promise", chosenPromise)}
        {!mineRes && !loading && (
          <div style={card}>
            {renderField("What do people already ask you for help with?", ask, setAsk, "The questions you get for free are a product in disguise")}
            {renderField("What did you figure out the hard way?", hardway, setHardway, "The shortcut you wish you'd had")}
            {renderField("What can you do faster or better than most?", faster, setFaster, "Your normal is someone's breakthrough")}
            {renderField("What transformation have you actually lived?", lived, setLived, "Lived proof beats borrowed theory")}
            <button style={ready ? btn : btnDis} disabled={!ready} onClick={genMine}>Mine my knowledge</button>
          </div>
        )}
        {loading && renderLoading()}
        {mineRes && !loading && (
          <div>
            <div style={{ ...body, marginBottom: 12 }}><span style={{ color: GOLD2 }}>{mineRes.why_first}</span></div>
            <div style={{ display: "grid", gap: 10 }}>
              {mineRes.ideas.map((idea, i) => (
                <div key={i} onClick={() => setIdeaIdx(i)} style={{ ...card, cursor: "pointer", borderColor: ideaIdx === i ? GOLD : LINE, background: ideaIdx === i ? PANEL2 : PANEL }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: FONT, color: CREAM, fontSize: 17, fontWeight: 800 }}>{idea.title}</div>
                    <div style={{ ...kicker, fontSize: 10.5 }}>{i === 0 ? "Recommended" : `Option ${i + 1}`}</div>
                  </div>
                  <div style={{ ...body, fontSize: 13.5, marginTop: 4 }}>{idea.format}</div>
                  <div style={{ fontFamily: FONT, color: GOLD2, fontSize: 14, marginTop: 8 }}>{idea.transformation}</div>
                  <div style={{ ...body, fontSize: 13.5, marginTop: 8 }}>{idea.why}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <button style={btn} onClick={() => advance(2)}>This is my product — Step 03</button>
              <button style={ghost} onClick={() => setMineRes(null)}>Edit my answers</button>
              <button style={ghost} onClick={genMine}>Regenerate</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderStep3() {
    return stepShell(2,
      <span>A product with no clear problem is invisible. Demand comes first; the topic comes second. The engine runs your idea through the <b style={{ color: CREAM }}>three demand checks</b>, then positions it: <b style={{ color: CREAM }}>problem + promise</b> — the problem named on the cover, the transformation promised on page one.</span>,
      <div>
        {renderContextCard("Your product", chosenIdea ? chosenIdea.title : "", chosenPromise)}
        {!posRes && !loading && <button style={btn} onClick={genPosition}>Run the demand checks & position it</button>}
        {loading && renderLoading()}
        {posRes && !loading && (
          <div>
            <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
              {posRes.checks.map((c, i) => (
                <div key={i} style={{ ...card, padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: FONT, color: CREAM, fontWeight: 700, fontSize: 14 }}>{c.check}</span>
                    <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: VERDICT_COLOR[c.verdict] || GOLD2 }}>{c.verdict}</span>
                  </div>
                  <div style={{ ...body, fontSize: 13.5, marginTop: 6 }}>{c.note}</div>
                </div>
              ))}
            </div>
            <div style={{ ...kicker, marginBottom: 8 }}>Pick your cover title — it should name the problem</div>
            <div style={{ display: "grid", gap: 10 }}>
              {posRes.titles.map((t, i) => (
                <div key={i} onClick={() => setTitleIdx(i)} style={{ ...card, cursor: "pointer", padding: "14px 18px", borderColor: titleIdx === i ? GOLD : LINE, background: titleIdx === i ? PANEL2 : PANEL }}>
                  <div style={{ fontFamily: FONT, color: CREAM, fontSize: 16.5, fontWeight: 800 }}>{t}</div>
                </div>
              ))}
            </div>
            <div style={{ ...card, marginTop: 14 }}>
              <div style={{ ...kicker, fontSize: 11 }}>Cover subtitle</div>
              <div style={{ fontFamily: FONT, color: CREAM, fontSize: 14.5, marginTop: 4 }}>{posRes.subtitle}</div>
              <div style={{ ...kicker, fontSize: 11, marginTop: 12 }}>Page-one promise</div>
              <div style={{ fontFamily: FONT, color: GOLD2, fontSize: 14.5, marginTop: 4 }}>{posRes.page_one_promise}</div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <button style={btn} onClick={() => advance(3)}>Positioned — Step 04</button>
              <button style={ghost} onClick={genPosition}>Regenerate</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderStep4() {
    const presets = [27, 47, 67, 97, 197];
    return stepShell(3,
      <span>$5,000 sounds like a mountain until you turn it into doors. Pick a price and watch it become a <b style={{ color: CREAM }}>small daily number you can actually control</b>. Set your floor. Hit it every day. Let the average do the work.</span>,
      <div>
        <div style={card}>
          <label style={lbl}>Your price</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {presets.map((p) => (
              <button key={p} onClick={() => { setPrice(p); setCustomPrice(""); }}
                style={{ ...ghost, padding: "10px 18px", fontSize: 15, background: effPrice === p && !customPrice ? GOLD : "transparent", color: effPrice === p && !customPrice ? INK : GOLD }}>
                ${p}
              </button>
            ))}
            <input style={{ ...inp, width: 110 }} type="number" min="1" placeholder="Custom $" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} />
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginTop: 22 }}>
            <div style={{ ...card, background: PANEL2, textAlign: "center" }}>
              <div style={{ fontFamily: FONT, color: GOLD, fontSize: 34, fontWeight: 800 }}>${effPrice}</div>
              <div style={{ ...lbl, marginBottom: 0, marginTop: 4 }}>your price</div>
            </div>
            <div style={{ ...card, background: PANEL2, textAlign: "center" }}>
              <div style={{ fontFamily: FONT, color: CREAM, fontSize: 34, fontWeight: 800 }}>≈ {salesNeeded}</div>
              <div style={{ ...lbl, marginBottom: 0, marginTop: 4 }}>sales to $5K</div>
            </div>
            <div style={{ ...card, background: PANEL2, textAlign: "center" }}>
              <div style={{ fontFamily: FONT, color: CREAM, fontSize: 22, fontWeight: 800, marginTop: 8 }}>{perDay}</div>
              <div style={{ ...lbl, marginBottom: 0, marginTop: 8 }}>for a month</div>
            </div>
          </div>
          <div style={{ ...card, background: PANEL2, borderLeft: `3px solid ${GOLD}`, marginTop: 14 }}>
            <div style={{ ...kicker, fontSize: 11 }}>Price like a closer</div>
            <div style={{ ...body, fontSize: 13.5, marginTop: 5 }}>
              Don't default to the cheapest price hoping for easy yeses — too cheap reads as low value. Anchor first: remind your buyer what the problem is costing them, or what a coach would charge, <i>then</i> show your price. Same number, completely different feeling.
            </div>
          </div>
          <div style={{ ...body, fontSize: 12, marginTop: 12, color: DIM }}>
            These are effort targets, not income promises — your results depend on your product, audience, and reps.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button style={btn} onClick={() => advance(4)}>Lock ${effPrice} — Step 05</button>
        </div>
      </div>
    );
  }

  function renderStep5() {
    return stepShell(4,
      <span>You don't open by selling — you open by giving. The line that took 1,000 doors to learn: <b style={{ color: CREAM }}>"Hey — I just wanted to let you know..."</b> The engine writes yours, pointed at your buyer's problem, ready to send.</span>,
      <div>
        {!flRes && !loading && <button style={btn} onClick={genFirstLine}>Write my first lines</button>}
        {loading && renderLoading()}
        {flRes && !loading && (
          <div>
            <div style={{ ...kicker, marginBottom: 8 }}>Your DM openers — pick your go-to</div>
            <div style={{ display: "grid", gap: 10 }}>
              {flRes.dms.map((d, i) => (
                <div key={i} onClick={() => setLineIdx(i)} style={{ ...card, cursor: "pointer", borderColor: lineIdx === i ? GOLD : LINE, background: lineIdx === i ? PANEL2 : PANEL }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ ...kicker, fontSize: 10.5 }}>{d.play}</div>
                    {renderCopyBtn(d.text, "dm" + i, true)}
                  </div>
                  <div style={{ fontFamily: FONT, color: CREAM, fontSize: 15, marginTop: 8, lineHeight: 1.5 }}>{d.text}</div>
                </div>
              ))}
            </div>
            <div style={{ ...kicker, margin: "18px 0 8px" }}>Content hooks</div>
            <div style={{ display: "grid", gap: 10 }}>
              {flRes.hooks.map((h, i) => (
                <div key={i} style={{ ...card, padding: "14px 18px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ fontFamily: FONT, color: CREAM, fontSize: 14.5, lineHeight: 1.5 }}>{h}</div>
                  {renderCopyBtn(h, "hk" + i, true)}
                </div>
              ))}
            </div>
            <div style={{ ...card, background: PANEL2, borderLeft: `3px solid ${GOLD}`, marginTop: 14 }}>
              <div style={{ ...body, fontSize: 13.5 }}>{flRes.coach}</div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <button style={btn} onClick={genLaunch}>Build my 7-Day Launch — Step 06</button>
              <button style={ghost} onClick={genFirstLine}>Regenerate</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderStep6() {
    if (!launchRes) {
      return stepShell(5,
        <span>Knowledge with no deadline is a hobby. The engine assembles your week — <b style={{ color: CREAM }}>don't perfect it, run it</b>.</span>,
        loading ? renderLoading() : <button style={btn} onClick={genLaunch}>Assemble my 7-Day Launch</button>
      );
    }
    return (
      <div>
        {renderStepper()}
        <div style={{ marginTop: 18 }}>
          <div style={kicker}>Step 06 · Your Launch Kit</div>
          <h2 style={h2S}>Your 7-Day Launch</h2>
          <div style={{ ...body, maxWidth: 640 }}>Everything you built, in one place. Don't perfect it — run it.</div>
        </div>

        {loading ? renderLoading() : (
          <div>
            <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
              {launchRes.days.map((d) => (
                <div key={d.day} style={{ ...card, padding: "14px 18px", display: "flex", gap: 16 }}>
                  <div style={{ fontFamily: FONT, color: GOLD, fontWeight: 800, fontSize: 13, minWidth: 52 }}>DAY {d.day}</div>
                  <div>
                    <div style={{ fontFamily: FONT, color: CREAM, fontWeight: 700, fontSize: 14.5 }}>{d.title}</div>
                    <div style={{ ...body, fontSize: 13.5, marginTop: 4 }}>{d.task}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ ...card, background: PANEL2, borderLeft: `3px solid ${GOLD}`, marginTop: 14 }}>
              <div style={{ ...kicker, fontSize: 11 }}>Your daily floor</div>
              <div style={{ fontFamily: FONT, color: CREAM, fontSize: 14.5, marginTop: 5 }}>{launchRes.floor}</div>
            </div>

            <div style={{ ...card, marginTop: 14 }}>
              <div style={{ ...kicker, fontSize: 11 }}>The full kit</div>
              <div style={{ ...body, fontSize: 13.5, marginTop: 6 }}>
                Promise: <span style={{ color: CREAM }}>{chosenPromise}</span><br />
                Product: <span style={{ color: CREAM }}>{chosenTitle || (chosenIdea && chosenIdea.title)}</span> · ${effPrice} · ≈{salesNeeded} sales to $5K ({perDay})<br />
                Go-to first line: <span style={{ color: CREAM }}>{chosenLine ? chosenLine.text : ""}</span>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <button style={btn} onClick={downloadKit}>Download my Launch Kit</button>
                {renderCopyBtn(kitText(), "kit")}
              </div>
            </div>

            <div style={{ ...card, marginTop: 14, borderColor: GOLD }}>
              <div style={{ fontFamily: FONT, color: GOLD2, fontStyle: "italic", fontSize: 15, lineHeight: 1.55 }}>{launchRes.sendoff}</div>
              <div style={{ fontFamily: FONT, color: CREAM, fontWeight: 700, marginTop: 10, fontSize: 13.5 }}>— Chris Slack · Golden Door Award Winner · 1,032 accounts closed</div>
            </div>

            <div style={{ ...body, fontSize: 12, margin: "18px 0 8px", color: DIM }}>
              This tool is for educational purposes only. Results are estimates based on the information you provided and do not account for your full financial situation. Consult a qualified financial professional before making investment or business decisions.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10, marginBottom: 30, flexWrap: "wrap" }}>
              <button style={ghost} onClick={genLaunch}>Regenerate my week</button>
            </div>
          </div>
        )}
        {error ? <div style={errS}>{error}</div> : null}
        {renderCodeGate()}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: INK }}>
      {renderHeader()}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "8px 20px 60px" }}>
        {screen === -1 && renderWelcome()}
        {screen === 0 && renderStep1()}
        {screen === 1 && renderStep2()}
        {screen === 2 && renderStep3()}
        {screen === 3 && renderStep4()}
        {screen === 4 && renderStep5()}
        {screen === 5 && renderStep6()}
      </div>
      <div style={{ borderTop: `1px solid ${LINE}`, padding: "14px 20px", textAlign: "center", fontFamily: FONT, fontSize: 11.5, color: DIM }}>
        THE $5K CLOSER · The Closer's Playbook · © Chris Slack
      </div>
    </div>
  );
}
