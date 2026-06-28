# 📤 Zernio Autoposter — Install Guide

Auto-post your videos to **Instagram + TikTok as drafts**, straight from a folder
on your computer. Record a clip → it shows up as a draft in Zernio, ready for you
to review and publish. No copy-pasting, no uploading by hand.

It runs **on your own computer**, so your videos and your API key never leave
your machine.

⏱️ **Setup takes about 10 minutes, once.** After that it just works.

---

## ✅ Before you start

You'll need:

- A **Windows or Mac** computer
- A **Zernio account** with your Instagram and/or TikTok connected
  (sign up / connect accounts at https://zernio.com)
- About 10 minutes

---

## Step 1 — Install Node (one time)

Node is the free engine that runs the autoposter.

1. Go to **https://nodejs.org**
2. Click the big green **"LTS"** button to download.
3. Open the downloaded file and click through the installer
   (**Next → Next → Install → Finish** on Windows; drag-to-install on Mac).
   Accept all the defaults.

> ✅ That's it — you never have to touch Node again.

---

## Step 2 — Get your Zernio API key

1. Log in at **https://zernio.com**
2. Go to **Settings → API keys** (or "Developer" / "API" section).
3. Click **Create / Generate key** and **copy it**. It starts with `sk_`.

🔒 **Keep this key private — it's like a password to your accounts. Never post it
publicly or share it with anyone.**

---

## Step 3 — Download the autoposter

1. You were given a file called **`zernio.zip`** (in our community / by your coach).
   Download it.
2. **Unzip it:**
   - **Windows:** right-click → **Extract All… → Extract**
   - **Mac:** double-click the zip
3. You'll get a **`zernio`** folder. Open it — you'll see files like
   `setup`, `run-watcher`, `post-video`, and `autopost.mjs`.

Put this folder somewhere easy to find, like your **Desktop**.

---

## Step 4 — First-time setup

This tells the autoposter your key and which folder to watch.

### 🪟 Windows
1. In the `zernio` folder, **double-click `setup.bat`**.
2. When asked, **paste your API key** (right-click pastes) and press **Enter**.
3. When asked for the **folder to watch**, paste the folder your videos save to,
   for example:
   ```
   C:\Users\YourName\Videos\Captures
   ```
   Press **Enter**. Done — it saves your settings.

### 🍎 Mac
1. Open the **Terminal** app.
2. Type `cd ` (with a space), then **drag the `zernio` folder into the Terminal
   window** and press **Enter**.
3. Create your settings file by running:
   ```sh
   cp .env.example .env
   open -e .env
   ```
4. In the editor, set these two lines and save:
   ```
   ZERNIO_API_KEY=sk_your_key_here
   ZERNIO_WATCH_DIR=/Users/YourName/Movies/Captures
   ```

---

## Step 5 — Use it 🎬

### Option A — Watch a folder (automatic)
Every new video dropped into your watched folder gets posted as a draft.

- **Windows:** double-click **`run-watcher.bat`**
- **Mac:** in Terminal (from the `zernio` folder) run `node autopost.mjs`

A window opens and says it's watching. **Leave it open.** Now record or drop a new
video into that folder — within a few seconds you'll see **`✔ draft created`**.
Close the window to stop.

### Option B — Post one specific video
- **Windows:** **drag a video file onto `post-video.bat`**
- **Mac:** `node autopost.mjs --once "/path/to/your/video.mp4"`

Either way, open **Zernio → Drafts** to review and publish. 🎉

---

## ✍️ Captions (optional)

- Want the **same caption on every post?** Open your `.env` file and set:
  ```
  ZERNIO_CAPTION=Your default caption here #hashtags
  ```
- Want a caption for **one specific video?** Put a text file next to it with the
  same name — e.g. `myclip.mp4` → `myclip.txt`. Whatever's in that text file
  becomes that video's caption.

---

## 🆘 Troubleshooting

| What you see | Fix |
|---|---|
| Window flashes and closes, or **`'node' is not recognized`** | Node isn't installed or needs a restart. Redo Step 1, then **restart your computer**. |
| **`ZERNIO_API_KEY is not set`** | Re-run setup (Step 4) and make sure you pasted your key. |
| **`Platform "instagram" is not connected`** | Connect that account inside Zernio first, or remove it from `ZERNIO_PLATFORMS` in your `.env`. |
| Video posts but looks cut off / incomplete | Your recording was still saving. Increase `ZERNIO_STABLE_MS` in `.env` (e.g. to `6000`). |
| Nothing happens when I drop a file | The watcher only posts **new** files added *after* it starts. Drop a fresh copy in, or use `post-video` (Option B). |

Still stuck? Post a screenshot of the window in the community and we'll help.

---

## 🔒 A note on safety

- Your **API key lives only on your computer** (in the `.env` file). It's never
  uploaded anywhere and never shared.
- **Never send your `.env` file or your key to anyone** — not even when asking for
  help. Cover it in screenshots.
- Each person uses **their own** Zernio key. Don't reuse someone else's.

That's it — happy posting! 🚀
