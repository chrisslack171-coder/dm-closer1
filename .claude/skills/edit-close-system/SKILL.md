---
name: edit-close-system
description: >
  Safely edit CLOSE_SYS — my closing system / system prompt — in api/close.js.
  Use this ANY time I ask to change how the DM Closer thinks, talks, reads a
  situation, handles an objection, picks a fork, or formats its output. Triggers
  on: "change the close system", "edit the prompt", "add an objection", "tweak
  the voice", "change the JSON output", "the AI is doing X, make it do Y".
---

# Edit the closing system (CLOSE_SYS)

## What this is for (one line)
Change the behavior of the DM Closer by editing `CLOSE_SYS` in `api/close.js`
without breaking my voice, my hard rules, the output contract, or the
server-only protection.

## Before you touch anything — the invariants
`CLOSE_SYS` is the product. Hold these the entire time:
1. It stays in `api/close.js`. Never copy any of it into `src/` or a response.
2. My voice: calm, low, direct, in control. Serve, don't chase. Human to human.
3. Hard bans: NO income/earnings claims, ever. NO attributing the method to any
   outside coach or system. If my instruction would require breaking one of
   these, STOP and tell me.
4. The `=== OUTPUT ===` JSON contract is shared with the frontend. If you touch
   it, you MUST also update `DMCloser.jsx` (see step 5).

## Step-by-step
1. **Read first.** Open `api/close.js` and read the whole `CLOSE_SYS` string.
   Find the section my request belongs to — the named blocks are:
   THE DOOR CLOSE · THE READ (STEP 1 lead types / STEP 2 S.A.L.E. / STEP 3 fork)
   · LAND EVERY SEND · BOOKING MECHANICS · THE CLOSER'S PATH · OUTPUT.
2. **Locate, don't guess.** Quote back to yourself the exact lines you'll change
   and which named block they're in. If the request spans blocks, list each.
3. **Make the smallest edit that does the job.** Preserve the surrounding
   sentence rhythm and my phrasing. Add to a list in the same terse style the
   list already uses. Don't reformat or "clean up" untouched text.
4. **Voice + rules pass.** Re-read your new text out loud. Does it sound like me
   (short, from the hip, unbothered)? Did you avoid every income claim and
   outside attribution? Fix it if not.
5. **Contract check.** If you changed the OUTPUT block — added/renamed a field, a
   new `fork` value, a new response shape — open `src/DMCloser.jsx` and update
   the matching piece: `parseJSON`, `CoachCard`, `FORK_COLOR`, `FORK_LABEL`.
   A new fork value needs BOTH a color and a label or the UI shows the raw code.
6. **Protection check.** Confirm your diff added nothing to `src/` that contains
   closing-system content, and added no logging/response of `CLOSE_SYS`.
7. **Report** in the exact output format below.

## Output format (what you hand back to me)
```
CHANGE: <one line — what behavior changed>
BLOCK(S) EDITED: <named CLOSE_SYS sections, e.g. "THE CLOSER'S PATH, OUTPUT">
FRONTEND TOUCHED: <yes: which functions / no>
CONTRACT IMPACT: <none | changed JSON — updated DMCloser.jsx to match>
VOICE/RULES: pass — no income claims, no outside attribution, sounds like me
DEPLOY: redeploy Vercel to take effect  (CLOSE_SYS is server-side)
```
Then show the diff of the changed lines only.

## Example of a great result
**Me:** "Add a call objection for 'I need to talk to my spouse first.'"

**You:** add one bullet to `THE CLOSER'S PATH`, in the existing style:
```
- "Need to talk to my spouse" → don't fight it, include them: "Totally fair —
  this is a real decision. What's the part you know they'll ask about? Let's get
  you an answer so it's you two deciding, not you guessing."
```
Then report:
```
CHANGE: added a spouse/partner objection to live-call handling
BLOCK(S) EDITED: THE CLOSER'S PATH
FRONTEND TOUCHED: no
CONTRACT IMPACT: none
VOICE/RULES: pass — no income claims, no outside attribution, sounds like me
DEPLOY: redeploy Vercel to take effect
```

## Do-nots
- ❌ Rewrite or restructure `CLOSE_SYS` wholesale when I asked for one change.
- ❌ Soften my voice into generic-assistant tone ("I'd be happy to help you…").
- ❌ Add any income/earnings claim or outside-coach attribution.
- ❌ Change the OUTPUT JSON on the server without updating `DMCloser.jsx`.
- ❌ Put any of this text on the client side or in a logged/returned value.
- ❌ Silently change model id, max_tokens, or the API shape while "in there."
