---
name: new-protected-tool
description: >
  Scaffold a new hub tool that follows the DM Closer pattern — a Vite/React
  frontend plus a Vercel serverless function that keeps my private prompt
  server-side. Use when I say "spin up a new tool", "build me another one like
  the DM Closer", "new protected AI tool", or "start a tool for <X>".
---

# New protected tool (scaffold)

## What this is for (one line)
Stand up a new single-purpose AI tool for my hub using the exact protection
pattern this repo already proves: my prompt lives on the server, the browser
never sees it, the endpoint is locked to my domains.

## The pattern I'm reusing (don't deviate)
- Frontend: one Vite + React page, inline styles, no framework/library, no
  state manager. Sends `{ messages }`, renders a parsed JSON response.
- Backend: one Vercel function that origin-checks, injects a server-only system
  prompt, calls Anthropic, returns ONLY the model text.
- Secret prompt in the function file; `ANTHROPIC_API_KEY` from `process.env`.

## Step-by-step
1. **Get the essentials from me first — ask only if missing:**
   - Tool name + one-line job.
   - The system prompt (the private "brains"), or a note that I'll paste it later
     into a clearly marked placeholder.
   - The output shape the frontend should render (freeform text, or a JSON
     contract — if JSON, get the fields).
   - My real domains for the `ALLOWED` list.
2. **Copy the shape of this repo**, don't reinvent it:
   - `api/<name>.js` modeled on `api/close.js`: `ALLOWED`, `originAllowed`,
     method + origin + key + prompt-installed guards, size caps, Anthropic
     fetch, return `{ text }` only, pass through 429/529/5xx.
   - `src/<Name>.jsx` modeled on `DMCloser.jsx`: `API_URL`, `callEngine` with
     retry, `parseJSON` if the response is JSON, render cards.
   - Reuse `index.html`, `vite.config.js`, `package.json` structure as-is.
3. **Wire the same protections:** prompt only in the function, never in `src/`;
   response carries no prompt; origin lock present; key from env.
4. **Keep my guardrails:** no income/earnings claims, no outside attribution,
   my voice in any coaching copy.
5. **Leave a placeholder if I didn't give the prompt yet** — a single obvious
   `const SYS = ` + "`PASTE_YOUR_SYSTEM_HERE`" + ` line and a one-time-setup
   comment, exactly like `close.js` does.
6. **Run ship-check** (the `ship-check` skill) against the new files before
   calling it done.

## Output format
```
NEW TOOL: <name> — <one-line job>
FILES CREATED:
  api/<name>.js       (server: origin lock + prompt injection + Anthropic call)
  src/<Name>.jsx      (frontend: send messages, render <text|JSON>)
  <any wiring changed: index.html / main.jsx>
PROMPT: <installed | placeholder PASTE_YOUR_SYSTEM_HERE — paste it in api/<name>.js>
OUTPUT SHAPE: <freeform text | JSON: fields…>
PROTECTIONS: prompt server-only ✓ · response is {text} only ✓ · ALLOWED set ✓ · key from env ✓
SHIP-CHECK: <ran — pass | blockers listed>
TO GO LIVE: set ANTHROPIC_API_KEY in Vercel, set ALLOWED to my domains, deploy, test logged-out.
```

## Example of a great result
**Me:** "Spin up an 'Offer Writer' tool — same protection. I'll paste the prompt."

**You:** create `api/offer.js` (clone of `close.js` with `SYS =
PASTE_YOUR_SYSTEM_HERE`, `ALLOWED` stubbed to my domains + a TODO), create
`src/OfferWriter.jsx` (clone of the frontend, `API_URL = "/api/offer"`, renders
plain text since no JSON contract yet), reuse the Vite config. Then report with
the block above, PROMPT = placeholder, and the go-live steps.

## Do-nots
- ❌ Don't add dependencies, a UI kit, or a backend service — match this repo.
- ❌ Don't put the system prompt anywhere the frontend bundles.
- ❌ Don't ship an open `ALLOWED` (`*` / empty) or open CORS.
- ❌ Don't hardcode the API key.
- ❌ Don't add income claims or outside attribution.
- ❌ Don't deploy for me — hand me the go-live steps.
