# DM Closer — protected deploy

Your closing system is now **server-side**. It lives in `api/close.js` and never
reaches a buyer's browser. The frontend (`src/DMCloser.jsx`) only sends the
conversation and receives the AI's answer. View-source on the live site reveals
no frameworks.

## What you have to do (one time)

### 1. Put your closing system into the server file
Open `api/close.js`. Find this line near the top:
```
const CLOSE_SYS = `PASTE_YOUR_CLOSE_SYS_HERE`;
```
Replace `PASTE_YOUR_CLOSE_SYS_HERE` with your full closing-system text (the big
block from your old front-end file — The Door Close, The Read, The Closer's Path,
Land Every Send, all of it). Keep it between the backticks.

> This is the whole point: the text goes HERE, on the server, not in the app.

### 2. Deploy to Vercel
- Push this folder to a GitHub repo, or drag-drop it into Vercel.
- Vercel auto-detects Vite + the `/api` function. No config needed.
- You'll get a URL like `https://dm-closer-xxx.vercel.app`.

### 3. Set the key
Vercel → Project → Settings → **Environment Variables**:
- Name: `ANTHROPIC_API_KEY`
- Value: your Anthropic key
- Redeploy after adding it.

### 4. Lock it to your domains
In `api/close.js`, edit the `ALLOWED` array to your real domain(s) — your hub
domain, your Stan, your Vercel URL. Remove `localhost` before final launch.
This stops other sites from calling your endpoint and burning your credits.

### 5. Point the hub at the new URL
Once it's live and tested, give me the Vercel URL and I'll swap the hub's
DM Closer link (slot 09) to it.

## Hosting note (important)
The frontend calls `/api/close` — a **same-origin** path. That works when the
frontend and the function are on the **same Vercel project** (which this folder
is set up to be). 

If you instead publish the frontend as a Claude artifact (like your other tools)
and keep only the API on Vercel, you must change one line in `src/DMCloser.jsx`:
```
const API_URL = "/api/close";
```
to the full URL:
```
const API_URL = "https://your-project.vercel.app/api/close";
```
Otherwise the artifact won't find the backend. Simplest path: host the whole
thing on Vercel so `/api/close` just works, and link the hub to the Vercel URL.

## Test before linking (do this logged out)
Open the live Vercel URL in an incognito window and run a full conversation —
start a situation, get moves, type a reply, get the next move. If it responds,
the protection AND the tool both work. Then send me the URL for the hub swap.
