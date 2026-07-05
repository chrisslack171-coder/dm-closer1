---
name: test-loop
description: >
  Prove the DM Closer actually works end-to-end — start a situation, get moves,
  send a reply, get the next move — and that the model's JSON parses and renders.
  Use before I link the hub, after any change to api/close.js or DMCloser.jsx,
  or when I say "test it", "does the loop work", "smoke test", "run a full
  conversation", "prove it before I ship".
---

# Test the loop (smoke test)

## What this is for (one line)
Confirm the whole conversation holds across turns — request shape, origin lock,
Anthropic call, JSON parse, and card render — so I never link a tool that looks
fine in the code but breaks on the second message.

## The reality of this stack (read before you run)
- The frontend calls `/api/close`, a **Vercel function** — plain `vite` does NOT
  serve it. Use `vercel dev` for a live loop, or the mock mode below if the
  Vercel CLI / API key isn't available.
- `api/close.js` **rejects requests with no `Origin`/`Referer`** and only allows
  hosts in `ALLOWED` (which includes `localhost`). A live request MUST send an
  `Origin: http://localhost:3000` header or it 403s — that's the protection
  working, not a bug.
- A live call spends real Anthropic credits and needs `ANTHROPIC_API_KEY` in the
  environment. Prefer mock mode for pure contract checks; use live mode when I
  want the real thing exercised.

## Pick a mode
- **Mock (default, no key, no cost):** verify the frontend contract against a
  known-good sample JSON. Proves parse + render + fork coverage. Run this always.
- **Live (needs `vercel dev` + `ANTHROPIC_API_KEY`):** run a real two-turn
  conversation against `/api/close`. Run this when I ask to actually ship or when
  the change touched the server call.

## Step-by-step — MOCK mode
1. Read the `=== OUTPUT ===` contract in `api/close.js` and the render code in
   `DMCloser.jsx` (`parseJSON`, `CoachCard`, `FORK_COLOR`, `FORK_LABEL`).
2. Build a sample response object that exercises the contract: a real `stage`,
   every `fork` value the model can emit at least once across your samples,
   `read`, 3 `responses` with `approach`/`apq`/`text`, and a `principle`.
3. Feed each sample through the SAME logic `parseJSON` uses (strip ```` ```json ````
   fences, `JSON.parse`, fallback to the first `{...}` match). Confirm it parses.
4. For each parsed object, assert the render contract:
   - `responses` is a non-empty array; each item has `approach` and `text`.
   - `fork` is either `—` or a key that exists in BOTH `FORK_COLOR` and
     `FORK_LABEL`. A fork missing from either is a FAIL (UI shows raw code).
   - `stage` and `principle` are strings.
5. Report using the output format below.

## Step-by-step — LIVE mode
1. Confirm `ANTHROPIC_API_KEY` is set and the Vercel CLI is available. If not,
   say so and fall back to mock mode — do not weaken the origin check to fake it.
2. Start the function server in the background: `vercel dev` (note the port,
   e.g. 3000). Give it a moment to boot.
3. **Turn 1 — start a situation.** POST to the local `/api/close` with a proper
   Origin header and the opening-message shape the frontend sends:
   ```
   curl -s http://localhost:3000/api/close \
     -H "Content-Type: application/json" \
     -H "Origin: http://localhost:3000" \
     -d '{"messages":[{"role":"user","content":"Here'\''s the situation:\n\nCold at the door, they say not interested and start closing it. Construction crew in the neighborhood.\n\nRead where this is and give me my opening moves."}]}'
   ```
   Assert: HTTP 200, body is `{ "text": "..." }`, and `text` parses as JSON
   matching the contract (step 4 of mock mode).
4. **Turn 2 — continue.** Take turn 1's raw assistant text, append it as an
   `assistant` message, add a `user` "The prospect said back: ..." message
   (mirror `continueConvo` in `DMCloser.jsx`), POST again with the same Origin.
   Assert the same contract holds — this is the whole point: the loop survives a
   second turn.
5. **Negative check (protection).** POST once with NO Origin header and confirm
   you get 403. If that returns 200, the origin lock is broken — FAIL loud.
6. Stop `vercel dev`. Report.

## Output format
```
TEST LOOP — <PASS | FAIL>  (mode: mock | live)

TURN 1 (start):     <pass | FAIL: what broke>
TURN 2 (continue):  <pass | FAIL: what broke>   [live only]
JSON PARSE:         <pass | FAIL: sample/turn that wouldn't parse>
RENDER CONTRACT:    <pass | FAIL: field/fork that breaks the UI>
ORIGIN LOCK:        <pass — no-origin request got 403 | FAIL | n/a mock>

DETAILS: <specifics — which fork lacked a color/label, which assertion failed>
VERDICT: <loop holds, safe to ship | FAIL — fix above before linking the hub>
```

## Example of a great result
```
TEST LOOP — FAIL  (mode: live)

TURN 1 (start):     pass — 200, valid JSON, stage "DOOR: agree & redirect"
TURN 2 (continue):  pass — 200, valid JSON, tracked to "DOOR: push-pull, they bit"
JSON PARSE:         pass
RENDER CONTRACT:    FAIL — turn 2 fork "REFER" has no FORK_COLOR/FORK_LABEL entry
ORIGIN LOCK:        pass — no-Origin request returned 403

DETAILS: DMCloser.jsx:63-64 — model emitted fork "REFER"; the badge will render
the raw string "REFER" with default gold instead of a labeled pill.
VERDICT: FAIL — add REFER to FORK_COLOR and FORK_LABEL, re-run, then link the hub.
```

## Do-nots
- ❌ Don't weaken or bypass the `ALLOWED` origin check to make a request pass —
  send a proper `Origin` header instead.
- ❌ Don't run live mode without a key by hardcoding one — fall back to mock.
- ❌ Don't call the loop good after one turn; the second turn is the real test.
- ❌ Don't print or paste `CLOSE_SYS` — the live response only carries `{ text }`,
  keep it that way and don't log the server prompt.
- ❌ Don't leave `vercel dev` running in the background after you report.
- ❌ Don't report PASS if the no-origin request returned anything but 403.
