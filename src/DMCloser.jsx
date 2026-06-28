import React, { useState, useRef, useEffect } from "react";

// THE DIGITAL CLOSER — DM Closer (multi-turn) — PROTECTED FRONTEND
// The closing system (CLOSE_SYS) lives on the server in /api/close.js and is
// NEVER present in this file. This frontend only sends the conversation and
// receives the AI's response. View-source on this reveals no frameworks.

const GOLD = "#C9A227";
const GOLD2 = "#d8b552";
const INK = "#14110c";
const PANEL = "#1d1913";
const PANEL2 = "#24201a";
const LINE = "#332c20";
const CREAM = "#f4efe4";
const MUT = "#a89c84";

// Where the protected backend lives. Same-origin "/api/close" if the frontend is
// hosted on the same Vercel project as the function. If you host the frontend
// somewhere else (e.g. a Claude artifact) and the API on Vercel, set the full URL:
//   const API_URL = "https://your-project.vercel.app/api/close";
const API_URL = "/api/close";

async function callEngine(messages) {
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (!r.ok) {
        if (r.status === 429 || r.status === 529 || r.status >= 500) {
          lastErr = "AI busy (" + r.status + ")";
          await new Promise((s) => setTimeout(s, 1500 * (attempt + 1)));
          continue;
        }
        const t = await r.text();
        throw new Error("Error " + r.status + ": " + t.slice(0, 120));
      }
      const data = await r.json();
      return data.text || "";
    } catch (e) {
      lastErr = e.message || "network error";
      await new Promise((s) => setTimeout(s, 1000 * (attempt + 1)));
    }
  }
  throw new Error(lastErr || "Couldn't reach the engine after 3 tries");
}

function parseJSON(t, fb) {
  const c = (t || "").replace(/```json|```/g, "").trim();
  try { return JSON.parse(c); } catch (e) {}
  const m = c.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return fb;
}

const btn = { background: GOLD, color: INK, border: "none", borderRadius: 8, padding: "13px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "Helvetica Neue, Arial, sans-serif" };
const ghost = { background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Helvetica Neue, Arial, sans-serif" };
const lbl = { display: "block", fontFamily: "Helvetica Neue, Arial, sans-serif", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: MUT, marginBottom: 7 };
const errS = { color: "#e0a07a", fontSize: 13, marginTop: 10, fontFamily: "Helvetica Neue, Arial, sans-serif" };

const FORK_COLOR = { BOOK: "#7bc47f", "DOWN-SELL": GOLD, NURTURE: "#7fb0d8", "RESCHEDULE-LAST": "#c98a4a", "BOOKING-STEP": "#b89a4a", DOOR: "#c97b5a" };
const FORK_LABEL = { BOOK: "Book the call", "DOWN-SELL": "Down-sell in DMs", NURTURE: "Nurture & value", "RESCHEDULE-LAST": "Reschedule last (triage)", "BOOKING-STEP": "Booking sequence", DOOR: "Door close" };

const EXAMPLES = [
  { label: "At the door: \"not interested\"", text: 'Cold at the door. The second I introduce myself they say "not interested" and start to close the door. There\'s a construction crew working in their neighborhood. How do I open this?' },
  { label: "Window shopper, just lurking", text: 'A lead has been watching my content for 2 months and commenting "this is so helpful" but never opted into anything. I want to reach out but not be weird about it.' },
  { label: "Tire-kicker inbound", text: 'A lead DMed me: "How do you deal with people that ghost you on a sales call? Been following you forever, love your content!"' },
  { label: "They can\'t afford it (on call)", text: '"I want to do this so badly, I just don\'t know if I can afford it right now. I have a lot of bills."' },
];

export default function DMCloser() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [turns, setTurns] = useState([]);
  const [reply, setReply] = useState("");
  const [copied, setCopied] = useState("");
  const scrollRef = useRef(null);
  const started = turns.length > 0;

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [turns, loading]);

  async function send(apiMessages, displayTurns) {
    setLoading(true); setError("");
    try {
      const raw = await callEngine(apiMessages);
      const p = parseJSON(raw, null);
      if (!p || !p.responses) { setError("Couldn't read that — try rephrasing what they said."); setLoading(false); return false; }
      setHistory([...apiMessages, { role: "assistant", content: raw }]);
      setTurns([...displayTurns, { kind: "coach", data: p }]);
      setLoading(false);
      return true;
    } catch (e) { setError("Couldn't reach the engine: " + (e.message || "unknown") + ". Tap retry."); setLoading(false); return false; }
  }

  async function start(custom) {
    const input = (custom != null ? custom : text);
    if (!input.trim()) return;
    const apiMessages = [{ role: "user", content: "Here's the situation:\n\n" + input + "\n\nRead where this is and give me my opening moves." }];
    const displayTurns = [{ kind: "situation", text: input }];
    setTurns(displayTurns);
    await send(apiMessages, displayTurns);
    setText("");
  }

  async function continueConvo() {
    if (!reply.trim() || loading) return;
    const said = reply.trim();
    const apiMessages = [...history, { role: "user", content: 'The prospect said back:\n\n"' + said + '"\n\nRe-read where the conversation is now and give me my next move.' }];
    const displayTurns = [...turns, { kind: "prospect", text: said }];
    setTurns(displayTurns);
    setReply("");
    await send(apiMessages, displayTurns);
  }

  function copyText(t, key) {
    const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); setCopied(key); setTimeout(() => setCopied(""), 2000); } catch (e) {}
    document.body.removeChild(ta);
  }

  function reset() { setTurns([]); setHistory([]); setText(""); setReply(""); setError(""); }

  function CoachCard({ data, idx }) {
    const fork = data.fork && data.fork !== "—" ? data.fork : null;
    return (
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "inline-block", background: "rgba(201,162,39,0.12)", border: `1px solid ${GOLD}`, borderRadius: 20, padding: "5px 14px" }}>
            <span style={{ fontFamily: "Helvetica Neue, Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: GOLD2 }}>{data.stage}</span>
          </div>
          {fork && (
            <div style={{ display: "inline-block", background: (FORK_COLOR[fork] || GOLD) + "22", border: `1px solid ${FORK_COLOR[fork] || GOLD}`, borderRadius: 20, padding: "5px 14px" }}>
              <span style={{ fontFamily: "Helvetica Neue, Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: FORK_COLOR[fork] || GOLD }}>→ {FORK_LABEL[fork] || fork}</span>
            </div>
          )}
        </div>

        {data.read && (
          <div style={{ background: PANEL2, border: `1px solid ${LINE}`, borderLeft: `3px solid ${GOLD}`, borderRadius: 8, padding: "13px 16px", marginBottom: 14 }}>
            <div style={{ fontFamily: "Helvetica Neue, Arial, sans-serif", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: GOLD, marginBottom: 5 }}>The read</div>
            <div style={{ fontSize: 14.5, color: "#e9e2d2", lineHeight: 1.5 }}>{data.read}</div>
          </div>
        )}

        <div style={{ fontFamily: "Helvetica Neue, Arial, sans-serif", fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: MUT, marginBottom: 9 }}>Your moves</div>
        {(data.responses || []).map((r, i) => (
          <div key={i} style={{ background: PANEL, border: `1px solid ${LINE}`, borderLeft: `4px solid ${GOLD}`, borderRadius: 8, padding: "13px 15px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 7, gap: 10 }}>
              <div>
                <div style={{ fontFamily: "Helvetica Neue, Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: GOLD2, marginBottom: 2 }}>{r.approach}</div>
                {r.apq && <div style={{ fontFamily: "Helvetica Neue, Arial, sans-serif", fontSize: 10.5, color: MUT, letterSpacing: 0.3 }}>{r.apq}</div>}
              </div>
              <button onClick={() => copyText(r.text, idx + "-" + i)} style={{ ...ghost, padding: "5px 12px", fontSize: 11.5, flexShrink: 0 }}>{copied === idx + "-" + i ? "Copied ✓" : "Copy"}</button>
            </div>
            <div style={{ fontSize: 14.5, lineHeight: 1.5, color: CREAM }}>{r.text}</div>
          </div>
        ))}

        {data.principle && (
          <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 12, marginTop: 8 }}>
            <div style={{ fontFamily: "Helvetica Neue, Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: GOLD, marginBottom: 4 }}>The principle</div>
            <div style={{ fontSize: 14, fontStyle: "italic", color: "#cfc6b2" }}>{data.principle}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: INK, color: CREAM, fontFamily: "Georgia, serif", padding: "0 0 40px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px" }}>
        <header style={{ padding: "40px 0 22px", borderBottom: `1px solid ${LINE}` }}>
          <div style={{ color: GOLD, fontFamily: "Helvetica Neue, Arial, sans-serif", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 14 }}>The Digital Closer · DM Closer</div>
          <h1 style={{ fontFamily: "Cambria, Georgia, serif", fontSize: 32, fontWeight: "normal", lineHeight: 1.1, margin: "0 0 10px" }}>
            Work the whole <em style={{ color: GOLD }}>conversation.</em>
          </h1>
          <p style={{ color: "#cfc6b2", fontSize: 15, maxWidth: "56ch", margin: 0 }}>
            Paste a door, a DM, a sales call, or a launch objection. Get your moves — then tell it what they said back and it reads the new spot, tracks the objection chain, and calls the next move. All the way to the close.
          </p>
        </header>

        {!started && (
          <div style={{ padding: "26px 0" }}>
            <label style={lbl}>The door, the DM, or the objection</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={'Paste a door situation ("they said not interested"), a DM thread, a sales call, or a launch objection…'}
              style={{ width: "100%", minHeight: 120, padding: "13px 15px", background: PANEL, border: `1px solid ${LINE}`, borderRadius: 8, color: CREAM, fontSize: 15, fontFamily: "Georgia, serif", marginBottom: 14, resize: "vertical", boxSizing: "border-box" }}
            />
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...lbl, marginBottom: 8 }}>Or start with one</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {EXAMPLES.map((ex, i) => (
                  <button key={i} onClick={() => start(ex.text)} disabled={loading} style={{ background: PANEL2, color: "#cfc6b2", border: `1px solid ${LINE}`, borderRadius: 20, padding: "6px 13px", fontSize: 12.5, cursor: "pointer", fontFamily: "Georgia, serif", fontStyle: "italic" }}>{ex.label}</button>
                ))}
              </div>
            </div>
            {error && <div style={errS}>{error}</div>}
            <button onClick={() => start()} disabled={loading || !text.trim()} style={{ ...btn, marginTop: 4, opacity: loading || !text.trim() ? 0.5 : 1 }}>{loading ? "Reading the room…" : "Read & call the move"}</button>
          </div>
        )}

        {started && (
          <div>
            <div ref={scrollRef} style={{ padding: "20px 0 6px" }}>
              {turns.map((t, i) => {
                if (t.kind === "situation") return (
                  <div key={i} style={{ marginBottom: 20 }}>
                    <div style={{ fontFamily: "Helvetica Neue, Arial, sans-serif", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: MUT, marginBottom: 6 }}>The situation</div>
                    <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 8, padding: "12px 15px", fontSize: 14.5, color: "#cfc6b2", lineHeight: 1.5, fontStyle: "italic" }}>{t.text}</div>
                  </div>
                );
                if (t.kind === "prospect") return (
                  <div key={i} style={{ marginBottom: 20, marginTop: 8 }}>
                    <div style={{ fontFamily: "Helvetica Neue, Arial, sans-serif", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#c97b5a", marginBottom: 6 }}>They said</div>
                    <div style={{ background: "rgba(201,123,90,0.08)", border: `1px solid rgba(201,123,90,0.35)`, borderRadius: 8, padding: "12px 15px", fontSize: 14.5, color: "#e9d9cf", lineHeight: 1.5 }}>{t.text}</div>
                  </div>
                );
                return <div key={i} style={{ marginBottom: 24 }}><CoachCard data={t.data} idx={i} /></div>;
              })}
              {loading && <div style={{ color: MUT, fontSize: 14, fontStyle: "italic", padding: "6px 0 14px" }}>Reading where it's at…</div>}
            </div>

            {error && <div style={errS}>{error}</div>}

            <div style={{ position: "sticky", bottom: 0, background: INK, paddingTop: 12, paddingBottom: 12, borderTop: `1px solid ${LINE}`, marginTop: 6 }}>
              <label style={{ ...lbl, marginBottom: 6 }}>What did they say back?</label>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) continueConvo(); }}
                placeholder="Type their response… (⌘/Ctrl + Enter to send)"
                style={{ width: "100%", minHeight: 60, padding: "11px 14px", background: PANEL, border: `1px solid ${LINE}`, borderRadius: 8, color: CREAM, fontSize: 14.5, fontFamily: "Georgia, serif", marginBottom: 10, resize: "vertical", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={continueConvo} disabled={loading || !reply.trim()} style={{ ...btn, padding: "11px 22px", fontSize: 14, opacity: loading || !reply.trim() ? 0.5 : 1 }}>{loading ? "Reading…" : "Next move →"}</button>
                <button onClick={reset} style={{ ...ghost, padding: "9px 16px" }}>New conversation</button>
              </div>
            </div>
          </div>
        )}

        {!started && (
          <footer style={{ paddingTop: 28, color: MUT, fontFamily: "Helvetica Neue, Arial, sans-serif", fontSize: 11, lineHeight: 1.7, borderTop: `1px solid ${LINE}`, marginTop: 10 }}>
            The Digital Closer · The Door Close · The Read · The Closer's Path · Serve, don't sell · No income claims.
          </footer>
        )}
      </div>
    </div>
  );
}
