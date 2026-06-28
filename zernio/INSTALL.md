# 🎬 Zernio Autoposter — Simple Setup

Post your videos to **Instagram & TikTok as drafts** automatically.
Set it up once (about 10 minutes). After that, it just works.

**How it works:** you drop a video in a folder → it shows up as a draft in
Zernio → you review and publish. That's it.

---

## What you need
- A computer (Windows or Mac)
- A Zernio account 👉 sign up at **zernio.com** and connect your Instagram / TikTok

---

## Step 1 — Install Node ▶️
This is the free engine that runs the tool. You only do this once.

1. Go to **nodejs.org**
2. Click the big green **LTS** button.
3. Open the file you downloaded and click **Next → Next → Install → Finish**.

✅ Done. You never touch this again.

---

## Step 2 — Get your Zernio key 🔑

1. Log in at **zernio.com**
2. Go to **Settings → API keys**
3. Click **Create key** and **copy it** (it starts with `sk_`).

🔒 **Keep this key private. It's like a password — never share it.**

---

## Step 3 — Open the folder 📂

1. Download **`zernio.zip`**.
2. Unzip it:
   - **Windows:** right-click → **Extract All → Extract**
   - **Mac:** double-click it
3. Open the **`zernio`** folder you get.

---

## Step 4 — Set it up (one time) ⚙️

**Windows:**
1. Double-click **`setup.bat`**.
2. **Paste your key** (right-click to paste) → press **Enter**.
3. **Paste the folder your videos save to** → press **Enter**. Example:
   `C:\Users\YourName\Videos\Captures`

That's it — your settings are saved.

**Mac:** see the short Mac steps at the bottom. 👇

---

## Step 5 — Post your videos 🚀

**To post ONE video right now:**
👉 Drag the video file onto **`post-video.bat`**.

**To auto-post everything new:**
👉 Double-click **`run-watcher.bat`** and leave the window open.
Now any new video you drop into your folder posts automatically.

Then open **Zernio → Drafts** to review and publish. 🎉

---

## Want a caption? ✍️ (optional)
- Same caption every time: open the `.env` file and set
  `ZERNIO_CAPTION=Your caption here #hashtags`
- Caption for one video: put a text file next to it with the same name
  (`myclip.mp4` → `myclip.txt`). What's in the text file becomes the caption.

---

## If something goes wrong 🆘

| Problem | Fix |
|---|---|
| Window flashes and closes / says `'node' is not recognized` | Redo Step 1, then **restart your computer**. |
| Says `ZERNIO_API_KEY is not set` | Redo Step 4 and make sure you pasted your key. |
| Nothing happens when I drop a file | The watcher only posts **new** files added after it starts. Drop a fresh copy in, or use `post-video.bat`. |

Still stuck? Post a screenshot in the community (cover your key!) and we'll help.

---

## 🍎 Mac setup (instead of Step 4)
1. Open the **Terminal** app.
2. Type `cd ` (with a space), drag the `zernio` folder into the window, press **Enter**.
3. Run these two lines:
   ```
   cp .env.example .env
   open -e .env
   ```
4. Set your key and folder, then save:
   ```
   ZERNIO_API_KEY=sk_your_key_here
   ZERNIO_WATCH_DIR=/Users/YourName/Movies/Captures
   ```
5. To post: `node autopost.mjs --once "/path/to/video.mp4"`
   To auto-watch: `node autopost.mjs`

---

🔒 **Remember:** your key stays on your own computer. Never share it, and never
send your `.env` file to anyone.
