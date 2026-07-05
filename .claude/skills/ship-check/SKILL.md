---
name: ship-check
description: >
  Pre-deploy safety and correctness checklist for the DM Closer before it goes
  live on Vercel or gets linked into the hub. Use when I say "ready to ship",
  "before I deploy", "check it before launch", "is this safe to go live", or
  after any change to api/close.js, DMCloser.jsx, or the ALLOWED domains.
---

# Ship check (pre-deploy)

## What this is for (one line)
Catch the things that get me hurt in production — a leaked closing system, an
open endpoint burning my API credits, a broken conversation loop — BEFORE the
tool is live or linked from the hub.

## Step-by-step
Run every check. Do not skip one because it "looks fine" — look.

1. **Protection: CLOSE_SYS never ships.**
   - Grep the client bundle sources (`src/`, `index.html`) for closing-system
     content. Confirm none of the named blocks (DOOR CLOSE, THE READ, CLOSER'S
     PATH, etc.) or long CLOSE_SYS phrases appear anywhere under `src/`.
   - Confirm `api/close.js` returns ONLY `{ text }` (or an `{ error }`), never
     the system prompt, and never `console.log`s `CLOSE_SYS`.
2. **CLOSE_SYS is actually installed.**
   - Confirm `CLOSE_SYS` is not the placeholder `PASTE_YOUR_CLOSE_SYS_HERE` and
     is non-empty. (The handler already 500s on this, but check anyway.)
3. **Origin lock is tight.**
   - Read `ALLOWED`. Confirm it lists my real domains and does NOT contain `*`,
     an empty string, or an overly broad match. For a real launch, `localhost`
     and `127.0.0.1` should be removed (flag them; don't remove without asking).
   - Confirm `originAllowed` still rejects requests with no referer/origin.
4. **Secrets.**
   - Confirm no `ANTHROPIC_API_KEY` value is hardcoded anywhere and nothing
     secret is committed. The key must come from `process.env` only.
5. **API contract intact.**
   - The model id in `api/close.js` is a real current Anthropic id.
   - The OUTPUT JSON described in `CLOSE_SYS` matches what `DMCloser.jsx`
     parses/renders (`parseJSON`, `CoachCard`, every `fork` value has a
     `FORK_COLOR` and `FORK_LABEL`).
6. **Loop sanity.**
   - Trace one full round in the code: `start()` → `send()` → `callEngine()` →
     `/api/close` → parse → render → `continueConvo()`. Confirm nothing you
     changed breaks the retry logic or the messages array shape.
   - If the `run` skill or a dev server is available, actually run one loop.
7. **Guardrail copy.**
   - No income/earnings claims and no outside-coach attribution in UI copy,
     README, examples, or CLOSE_SYS.

## Output format
Report as a checklist with a verdict. Be specific about failures — file + line.
```
SHIP CHECK — <ready to deploy | NOT ready>

[✓/✗] CLOSE_SYS not in client bundle
[ ] CLOSE_SYS not logged or returned
[ ] CLOSE_SYS installed (not placeholder)
[ ] ALLOWED locked (no *, localhost handled)
[ ] No secrets committed
[ ] Model id valid
[ ] OUTPUT JSON contract matches frontend
[ ] Full conversation loop intact
[ ] No income claims / outside attribution

BLOCKERS: <numbered list with file:line, or "none">
NON-BLOCKING NOTES: <e.g. "localhost still in ALLOWED — remove before final launch">
NEXT: <what I should do — e.g. "safe to push + redeploy Vercel", or "fix blocker 1 first">
```

## Example of a great result
```
SHIP CHECK — NOT ready

[✓] CLOSE_SYS not in client bundle
[✓] CLOSE_SYS not logged or returned
[✓] CLOSE_SYS installed (not placeholder)
[✗] ALLOWED locked — api/close.js:99 still includes "localhost" and "127.0.0.1"
[✓] No secrets committed
[✓] Model id valid
[✗] OUTPUT JSON contract — DMCloser.jsx:63 has no FORK_COLOR for new "REFER" fork
[✓] Full conversation loop intact
[✓] No income claims / outside attribution

BLOCKERS:
  1. api/close.js:94-101 — remove localhost/127.0.0.1 before a public launch,
     or the endpoint accepts calls from any local page.
  2. DMCloser.jsx:63-64 — add REFER to FORK_COLOR and FORK_LABEL or the badge
     renders the raw code "REFER".

NEXT: fix blocker 2 now; confirm with me on blocker 1 (keep localhost if you're
still testing, remove it the moment you link the hub).
```

## Do-nots
- ❌ Don't pass the check by eyeballing — grep and read the actual lines.
- ❌ Don't silently remove `localhost` — flag it and let me decide timing.
- ❌ Don't widen `ALLOWED` or add open CORS to make a test pass.
- ❌ Don't report "ready" if any protection or secret check failed.
- ❌ Don't deploy or push on my behalf unless I asked — this skill reports.
