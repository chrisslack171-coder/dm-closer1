# CLAUDE.md — The Digital Closer / DM Closer

This is my project guide for you. Read it before you touch anything. Match how
this repo already works — don't invent new patterns, new frameworks, or new
files unless I ask.

## What this project is (one line)
A single-page React tool that coaches me (and buyers of my program) through live
sales conversations — the door, DMs, and call objections — powered by my private
closing system, which lives ONLY on the server so it can never be copied.

## The one rule that matters most
`CLOSE_SYS` — my closing system — is the whole business. It lives in
`api/close.js`, server-side, and is injected as the `system` prompt on the
Anthropic call. **It must never reach the browser.** That means:

- NEVER move `CLOSE_SYS`, or any part of it, into `src/` or any file the
  frontend bundles or ships.
- NEVER log `CLOSE_SYS`, echo it in an API response, or add a debug/route that
  returns it.
- The frontend sends `{ messages }` and receives `{ text }`. Nothing else about
  the system prompt is ever in the response payload. Keep it that way.

If a change you're about to make would put any closing-system text on the client
side, STOP and tell me instead of doing it.

## The stack (don't add to it without asking)
- **Frontend:** React 18 + Vite. Plain inline styles, no CSS framework, no
  component library, no state manager. One component: `src/DMCloser.jsx`.
- **Backend:** a single Vercel serverless function, `api/close.js`. No database,
  no auth service, no extra dependencies.
- **Model call:** direct `fetch` to `https://api.anthropic.com/v1/messages`.
  Current model id is in `api/close.js` — check it, don't assume.
- **Deploy target:** Vercel (auto-detects Vite + `/api`). Env var
  `ANTHROPIC_API_KEY` is set in Vercel, never committed.

Keep `package.json` lean. Do not add dependencies to solve something plain
React or a few lines of JS can do. If you think a dependency is genuinely
needed, ask me first and say why.

## How the two files talk
1. Frontend collects the situation + running conversation, POSTs `{ messages }`
   to `API_URL` (`/api/close`).
2. `api/close.js` checks the origin against `ALLOWED`, injects `CLOSE_SYS` as the
   system prompt, calls Anthropic, and returns `{ text }`.
3. Frontend parses the model's JSON (see the OUTPUT contract inside `CLOSE_SYS`)
   and renders the stage / fork / read / moves / principle cards.

If you change the JSON shape the model returns, you MUST update BOTH the OUTPUT
section of `CLOSE_SYS` in `api/close.js` AND the rendering in `DMCloser.jsx`
(`CoachCard`, `FORK_COLOR`, `FORK_LABEL`, `parseJSON`). They are a contract.
Changing one without the other breaks the tool silently.

## My voice and my rules (these apply to the product, and to you)
- Calm, low, direct, in control. Serve, don't chase. Human talking to a human.
- NEVER coach, make, or imply income/earnings claims anywhere — in `CLOSE_SYS`,
  in UI copy, in the README, in examples. This is a hard line.
- Don't attribute the method to any outside coach or system. It's mine, built in
  the field.

## Working with me
- Small, surgical diffs. Don't refactor things I didn't ask you to touch.
- Match the existing code style (inline style objects, short helper functions,
  the naming already in the files).
- When you finish a change, tell me in plain language: what you changed, whether
  it affects the client/server boundary, and whether I need to redeploy or reset
  any Vercel env vars.
- Before you commit, sanity-check that the tool still runs a full loop: start a
  situation → get moves → send a reply → get the next move.

## Do-nots (quick list)
- ❌ Put any closing-system text in the frontend or in a response body.
- ❌ Add frameworks, UI libraries, or dependencies without asking.
- ❌ Commit secrets or an `ANTHROPIC_API_KEY`. It lives in Vercel only.
- ❌ Loosen the `ALLOWED` origin check or add `*`/open CORS "to make testing
  easier." Tell me if testing is blocked; don't widen the door.
- ❌ Change the model/response JSON on only one side of the contract.
- ❌ Add income claims or outside attributions anywhere.
