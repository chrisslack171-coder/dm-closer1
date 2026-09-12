# Character Builder — build the face, lock the look

Describe the person you want on camera in plain words. The server casts one
**specific, reproducible** human — face, hair, wardrobe, presence, voice,
backstory — and the browser assembles the prompts you actually paste into an
image model.

Three outputs matter:

- **Identity lock** — the physical-facts block you paste at the top of *every*
  generation. This is what brings the same face back.
- **Reference sheet** — a two-panel prompt (beauty close-up + full body, one
  identical person, seamless grey studio sweep). Generate this first and keep
  the image.
- **Per-shot prompts** — identity lock + wardrobe + presence + scene, one per
  shot idea, ready to paste.

Plus a voice brief for voice cloning and a negative prompt that kills the
plastic-AI look.

Every field is editable and **every prompt rebuilds live from the fields** —
change the hair colour and all the prompts update. Refine in plain words
("a bit older", "give him glasses and a beard") with one-step undo. Your roster
saves on this device; export as TXT per character, or CSV / JSON for the lot.

## The workflow that actually holds one face

1. Build the character.
2. Generate the **reference sheet** and keep that image.
3. For every later shot: paste the identity lock **and** attach the sheet as a
   reference image.

Step 3 is the part people skip. The prompt alone drifts; the prompt plus the
sheet does not.

## Protection

The casting system prompt lives in `api/build.js`, server-side. The frontend
(`src/CharacterBuilder.jsx`) only sends the brief and receives fields back.
View-source on the live site reveals no system prompt and no API key.

## Deploy

### 1. Push to a repo, then import into Vercel
Set the project's **Root Directory** to `character-builder`. Vercel auto-detects
Vite + the `/api` function; `vercel.json` already raises the function timeout to
60s.

### 2. Set the key
Vercel → Project → Settings → **Environment Variables**:
- Name: `ANTHROPIC_API_KEY`
- Value: your Anthropic key
- Redeploy after adding it.

### 3. Lock it to your domains
In `api/build.js`, edit the `ALLOWED` array to your real domain(s) — your hub
domain, your Stan, your Vercel URL. **Remove `localhost` and `127.0.0.1` before
final launch.** This stops other sites calling your endpoint and burning your
credits.

### 4. Test logged out
Open the live URL in an incognito window, build a character, refine it once,
copy a prompt. If it responds, the protection *and* the tool both work.

## Hosting note

The frontend calls `/api/build` — a **same-origin** path, which works because
the frontend and the function are one Vercel project. If you host the frontend
elsewhere, change one line in `src/CharacterBuilder.jsx`:

```js
const API_BASE = "";
```
to
```js
const API_BASE = "https://your-project.vercel.app";
```

## Local dev

```bash
npm install
npm run dev
```

`npm run dev` serves the frontend only — Vite does not run `/api`. To exercise
the API locally use `vercel dev` with `ANTHROPIC_API_KEY` set, or just deploy a
preview.

## Notes on the casting

The server is instructed to (a) write every physical field specific enough to
reproduce, (b) always give each character 2-3 hard identity anchors (a mole, a
gap tooth, a cowlick) because those are what hold identity across generations,
and (c) never describe or approximate a real or famous person. A style
reference URL, if you supply one, is read for mood, lighting and wardrobe only —
never to copy the person in it.

Model: `claude-sonnet-5`. Change it in `api/build.js` if you want a cheaper or
faster one.
