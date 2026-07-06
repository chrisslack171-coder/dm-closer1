# 🛠️ Setup — read this first

This is a **video editing system you run with [Claude Code](https://claude.com/claude-code).** You
drop in raw footage, and Claude takes it from **raw → fully edited → exported.** It does short-form
explainers, TikTok/raw-style verticals, and long-form YouTube intros, with locked, on-brand captions,
graphics, and thumbnails.

**Runs on macOS, on Windows via WSL2 (Ubuntu), or on Linux.** On a Mac it uses Apple's hardware video
encoder; on Windows/Linux it uses software encoding — same output, just a bit slower.

The fastest path: unzip, open this folder in Claude Code, and say **"set me up."** Claude reads this
file and walks you through everything below. Or do it by hand — it's all here.

### 🪟 On Windows — do this one-time setup first

This system is Unix software; on Windows it runs inside **WSL2 (Ubuntu)**, a real Linux environment
built into Windows. It does **not** run in PowerShell/cmd.

1. In an **Administrator PowerShell**: `wsl --install`, then reboot if prompted (installs Ubuntu).
2. Open the **Ubuntu** terminal and **unzip the project there** — *not* with Windows Explorer, which
   breaks the scripts' Unix line endings and executable bits:
   ```bash
   cd ~ && unzip /mnt/c/Users/<you>/Downloads/video-editor-client.zip
   ```
   Keep it under your Linux home (`~`), not `/mnt/c` — much faster.
3. Launch Claude Code from inside Ubuntu (`cd ~/video-editor && claude`). Everything below now runs
   unchanged; wherever a command says `brew`, use the `sudo apt` version under
   **"Windows / Linux (WSL2 · Ubuntu)"** below.

---

## 1. Install the prerequisites

Run the included checker first — it tells you exactly what's missing:

```bash
./check-setup.sh
```

### Core (required — the raw → exported pipeline)

`./check-setup.sh` prints the right command for whichever OS you're on — run it and follow what it shows.

**macOS:**

```bash
# Homebrew (skip if you already have it)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install ffmpeg          # every audio/video pass (cut, captions, music, render)
brew install uv              # builds the WhisperX transcription engine on first run
brew install node            # the graphics render engine (npx hyperframes)
brew install python          # caption + thumbnail text overlays
brew install pillow          # PIL — text overlays (this ffmpeg has no built-in text)
```

**Windows / Linux (WSL2 · Ubuntu):**

```bash
sudo apt update
sudo apt install -y ffmpeg python3 python3-pip python3-pil   # video passes + caption/thumbnail text (PIL)

# Node ≥22 (the render engine) — Ubuntu's apt node is too old, so use NodeSource:
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs

# uv (builds the WhisperX transcription engine on first run):
curl -LsSf https://astral.sh/uv/install.sh | sh

sudo apt install -y wamerican   # optional: enables the transcript-QA word scan
```

Then bootstrap the render engine **once**:

```bash
npx hyperframes@0.7.3 doctor   # downloads the headless browser the graphics renderer uses
```

> Pinned to `@0.7.3` — the version the locked caption/graphics presets were built and validated against.
> Using the same version for the one-time bootstrap means it's cached once and every render uses it.
>
> **On WSL,** if `doctor` (or a render) reports a missing shared library, install the headless-Chrome
> deps it names, e.g. `sudo apt install -y libnss3 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libasound2t64`.

**First edit is slow, once.** The first time you run a job, the rough-cut step downloads the WhisperX
`large-v3` speech model (~3–5 GB) and builds its environment. That takes several minutes and needs
internet — but only the first time. Every job after is fast. (Same idea, much smaller: the face-framing
tool `workflows/face-frame.py` auto-installs its OpenCV dependency via `uv` on first use, ~50 MB.)

### Fonts — all bundled, nothing to install

- **Inter** — bundled in `assets/fonts/` (free, Open Font License). The display font for signature-style
  and long-form graphics. Nothing to install — and it's the cross-platform default. *(macOS only:
  prefer Apple's SF Pro?* Install the free "San Francisco Pro" pack from <https://developer.apple.com/fonts>
  and set it in `brand-kit.md`. On Windows/Linux, stay on the bundled Inter.)
- **Coolvetica** — bundled in `assets/fonts/` (the locked explainer caption look). Nothing to do.
- **SF Pro (system)** — *optional.* The TikTok/raw overlays render from bundled **Inter** by default; SF Pro is not required.

### Optional (only if you use the feature)

- **Thumbnails (long-form):** the Higgsfield CLI + a paid Higgsfield account —
  `curl -fsSL https://raw.githubusercontent.com/higgsfield-ai/cli/main/install.sh | sh` then
  `higgsfield auth login`.
- **Premiere off-ramp** (finish a cut by hand in Premiere instead of HyperFrames): see
  `.mcp.json.example` and `npm i -g premiere-pro-mcp && premiere-pro-mcp --install-cep`. Requires Adobe
  Premiere Pro 2025 with the MCP Bridge panel running. Restart Claude Code after copying
  `.mcp.json.example` → `.mcp.json`.
- **Speaker labels** (`rough-cut --diarize`): set `HUGGINGFACE_TOKEN` (see `.env.example`). The normal
  single-speaker flow does **not** need this.

---

## 2. Make it yours — the few things to replace

This system ships with placeholder branding. Personalize it **once**:

1. **Fill in `brand-kit.md`** — your name, niche, handles, voice/tone, brand colors, fonts, hook style,
   and brand wordlist. This is the one file that drives how every caption and thumbnail sounds and looks.
   (Part A is the fill-in form; **Part B** spells out exactly which file and token each value changes, if
   you want to do it by hand or verify Claude's work.)
2. **Drop your face photos** into `assets/face-refs/` — 4–8 photos of *your* face (varied angles /
   expressions / lighting). Only needed if you want generated thumbnails. See that folder's README.
3. *(Optional)* **Add your logos** to `assets/logos/` — any brand marks you want available for thumbnails.

Then tell Claude **"apply my brand kit"** and it writes those values into the presets and `CLAUDE.md`
for you. (Claude also does this automatically the first time you open the project — see the onboarding
gate at the top of `CLAUDE.md`.)

---

## 3. Edit your first video

1. Put a raw clip somewhere handy (e.g. `~/Downloads`).
2. In Claude Code, say: **"edit this video: ~/Downloads/yourclip.mp4"**.
3. Claude copies it into `projects/<job>/raw/`, runs the rough cut, plans graphics, and walks the rest
   of the pipeline with you. If the format isn't obvious it asks one question: short or long? explainer
   or TikTok/raw?
4. The finished file lands in `projects/<job>/outputs/<job>.mp4` (or `.final.mp4` for captioned
   short-form). That's the deliverable.

That's it. The whole pipeline and how each step works is documented in `CLAUDE.md`.

---

## What's in the box

| Path | What it is |
|------|-----------|
| `CLAUDE.md` | The editor's brain — the pipeline, the rules, the format variants. |
| `brand-kit.md` | The one file you fill in. |
| `check-setup.sh` | Prerequisite checker (report-only). |
| `.claude/skills/` | The editing skills + the HyperFrames render toolkit. |
| `presets/` | The locked looks — signature style, captions, TikTok/raw, liquid-glass. |
| `workflows/` | Per-format layout + safe-zone references. |
| `assets/` | Fonts (bundled) + your face refs / logos / thumbnail templates (you supply). |
| `projects/` | Your job folders land here (one per video). |
| `prune.sh` | Reclaims disk space from old render scratch (dry-run by default). |
