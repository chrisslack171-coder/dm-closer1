# CLAUDE.md — Video Editor

Your **video production & editing department** — and **only** that. Raw filmed footage comes in,
a finished exported cut goes out. This system is self-contained: you point it at a raw clip and it
takes that clip from **raw → fully edited → exported.** What happens to the export afterward
(posting, scheduling) is out of scope — this repo's job ends at the rendered file.

Not a traditional code repo — a content system where **Claude IS the editor.** Each stage runs
through a skill in `.claude/skills/`.

---

## 🪟 On Windows? Set up WSL2 FIRST (one time, before anything else)

This system runs on **macOS** or **Linux**. On **Windows** it runs inside **WSL2 (Ubuntu)** — a real
Linux environment built into Windows. Every tool here (the `.sh` scripts, ffmpeg, WhisperX, the render
engine) is Unix and does **not** run in PowerShell/cmd.

**Figure out where you are** — run `uname -s` in the shell:
- `Darwin` (macOS) or `Linux` (this includes WSL) → you're set, skip to **FIRST RUN** below.
- Command-not-found / Windows-looking output (`C:\…` paths) → you're on **native Windows**. Do this first:

1. **Install WSL2 + Ubuntu.** In an **Administrator PowerShell** run `wsl --install` (you can run this
   yourself via the Bash tool), then **reboot** if prompted. That installs Ubuntu Linux inside Windows.
2. **Unzip the project _inside_ Ubuntu** — not with Windows Explorer. Open the **Ubuntu** terminal:
   ```bash
   cd ~                                                   # Linux home: fast. Avoid /mnt/c (slow).
   unzip /mnt/c/Users/<you>/Downloads/video-editor-client.zip
   ```
   Unzipping inside Ubuntu preserves the scripts' Unix line endings + executable bits (Windows unzip
   tools break both, which then makes the `.sh` scripts fail).
3. **Launch Claude Code from inside Ubuntu** on this folder (`cd ~/video-editor && claude`), then
   continue to FIRST RUN below. From here on, every command in this guide runs unchanged.

> Why WSL: it's the easiest path that just works — the whole system runs as-is in Linux instead of
> being rewritten for Windows. Apple's hardware video encoder is a Mac-only speed perk; on WSL/Linux
> the render falls back to software encoding (same result, a bit slower). Nothing else differs.

---

## 🚦 FIRST RUN — onboarding gate (read this before doing anything else)

**This is the first thing to handle when the project opens.** A SessionStart hook
(`.claude/hooks/setup-check.sh`) also injects a reminder for as long as setup is incomplete. Trigger this
flow whenever the user says **"set me up"** / **"set up"**, **or** asks to edit/cut/process any video
while the install is still fresh — on a fresh install, do **not** start an edit job (you'd ship a video
carrying the original author's brand).

**Is this a fresh, un-personalized install?** Decide it deterministically:

```bash
grep -c '<<' brand-kit.md      # >0 ⇒ still has <<FILL_ME>> tokens ⇒ FRESH (not set up yet)
```

If that prints `0`, setup is already done — skip this gate and work normally. If it prints more than
`0`, **STOP and walk the user through setup, in order:**

1. **Install the prerequisites — actively. Don't just hand the user a list.** Run `./check-setup.sh`
   (it's report-only — it installs nothing). It **prints the exact install command for the current OS**
   (Homebrew on macOS, `apt` on Linux/WSL2). For **every item it flags as missing (`✗` or `!`)**, offer
   to run the command it shows and, on a yes, **execute it yourself** in the shell:
   - **macOS:** if Homebrew is missing, install it first
     (`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`),
     then `brew install ffmpeg uv node python pillow`.
   - **Linux / WSL2 (Ubuntu):** `sudo apt update && sudo apt install -y ffmpeg python3 python3-pip python3-pil`;
     Node ≥22 via NodeSource (`curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`);
     `uv` via `curl -LsSf https://astral.sh/uv/install.sh | sh`.
   **Re-run `./check-setup.sh` until every core item passes** before continuing. (Full per-OS command
   list lives in `SETUP.md`.)
2. **Bootstrap the render engine** — once: `npx hyperframes@0.7.3 doctor` (downloads the headless browser
   the graphics renderer uses; pinned to the version the locked presets were built against).
3. **Fill in the brand kit** — open `brand-kit.md` together and collect Part A (handles, niche,
   voice/tone, colors, fonts, hook style). When it's filled, **apply it** by following the exact
   file-by-file map in **`brand-kit.md` Part B**: colors into both graphics presets (the `--token` table
   *and* the inline `rgba()` in the CSS), identity/voice into this `CLAUDE.md`'s Brand Kit section,
   wordlist into `presets/caption-corrections.json`, hook into `presets/tiktok-raw/build.py`. Then render
   one quick test to confirm the font + hero color took.

**Onboarding is done once `brand-kit.md` has no `<<…>>` tokens left.** Proceed normally and don't re-run
this gate every session.

> **Face refs are optional** — they're only used for long-form YouTube *thumbnails*. When the user first
> asks for a thumbnail, have them drop 4–8 photos of their own face into `assets/face-refs/` (see that
> folder's README). Short-form-only creators never need them, so don't block onboarding on this.

---

## Brand Kit

The editor's voice and look come **entirely from [`brand-kit.md`](brand-kit.md)** and the presets it
feeds. Captions and on-thumbnail copy should sound like the creator described there; the signature
look is locked in [`presets/signature-style.md`](presets/signature-style.md). Apply those verbatim.

> On a fresh install these still hold the original author's placeholder values until you run the
> onboarding gate above. Never ship a client's video carrying someone else's handle, hook, or colors.

---

## The Pipeline — one linear flow, every time

Every job runs the **same seven steps, in order**, raw → done. Format (short vs long, explainer vs
TikTok/raw) does **not** change the flow — it only changes how **Graphics (step 3)** and
**Captions (step 5)** behave. So don't "pick a workflow" up front. Run the line; branch only inside
those two steps.

| # | Step | Skill | What happens |
|---|------|-------|--------------|
| 1 | **Intake** | _(copy)_ | Point to a raw file (often in `~/Downloads`). **Copy** it into `projects/<job>/raw/` — never move, never touch the original, so the source clip is safe if a render goes sideways. Name `<job>` after the content (see Job naming). |
| 2 | **Rough cut** | `rough-cut` | Always, every format. WhisperX large-v3 transcribe + word-align → kill filler/dead air → stitch → **normalize audio with a STATIC chain (+10 dB amplify → −6 dBFS hard limiter — NOT dynamic loudnorm, which pumps)**. Produces the cut **and the finished script** (the kept-words transcript) — the source of truth for everything downstream. |
| 3 | **Graphics** | `graphics-plan` → HyperFrames | Two sub-steps. **(a) Plan** (`graphics-plan`) — reads the rough-cut transcript and decides, beat by beat: graphic or not? what kind? where exactly? Writes `graphics-plan.{json,md}`. **(b) Create** — build the planned graphics in HyperFrames. For the split-frame explainer preset, **measure the face crop first** — `uv run workflows/face-frame.py projects/<job>/outputs/<job>.mp4` prints the exact `#head` `object-position` (locked standard: median hair top 50 px below the y960 seam — measured, never guessed). The *content* diverges by format (below); the step doesn't. |
| 4 | **Second pass** | _(manual)_ | The first graphics pass is a draft. Review and call adjustments — cut this graphic, swap that one, move it, redo. **Iterate incrementally:** render/lock graphics part-by-part and recomposite with ffmpeg (~5s) instead of re-rendering the whole video each tweak — see [`workflows/incremental-graphics.md`](workflows/incremental-graphics.md). |
| 5 | **Captions** | `presets/captions-style.md` (explainer) · `presets/tiktok-raw-style.md` (TikTok/raw) | **Short-form only.** Explainer → use the **LOCKED caption preset** ([`presets/captions-style.md`](presets/captions-style.md): Coolvetica white-on-black box, dead-centered on the seam, full-phrase box, words pop in on-beat). TikTok/raw → captions **low, under the face** ([`presets/tiktok-raw-style.md`](presets/tiktok-raw-style.md)). Both build from the canonical `outputs/<job>.transcript.json` — never re-transcribe. **Long-form → skip** (YouTube serves its own CC). |
| 6 | **Background music** | `background-music` | **Optional, format-agnostic.** Lays a music bed under the voice — a **flat constant bed** by default (no ducking, no fade-in, −18 dB, short tail fade-out only). Ducking (sidechain + re-normalize to −14 LUFS) and fade-in are **opt-in**. Pure audio pass (video copied, no re-encode). Most useful on short-form explainers; skip unless asked. Track lives in `projects/<job>/audio/`. |
| 7 | **Export** | _(render → `finalize.sh`)_ | Render the final, then **finalize** so the folder is unambiguous: `./finalize.sh <job>` (dry-run; `--apply` to act) promotes the latest render to the **one** canonical deliverable **`projects/<job>/outputs/<job>.final.mp4`** and retires dead drafts, while **keeping** the base cut (`<job>.mp4`), transcript, and `hf-graphics/` source so the job can be reopened. That's the finish line. Then `./prune.sh --apply` reclaims the regenerable cache. |

**Optional off-ramp after step 2:** instead of finishing in HyperFrames (steps 3–7), hand the rough
cut to **Adobe Premiere Pro** via the `to-premiere` skill and finish editing by hand there. Requires
the `premiere-pro` MCP bridge running — see SETUP.md (optional feature).

### Format variants — only steps 3 & 5 change

Decide the format when you reach **Graphics**, not before. If it's not obvious from the footage, ask
one line: **(1) short or long? (2) if short — explainer or TikTok/raw?**

| | **Short · Explainer** | **Short · TikTok/raw** | **Long-form** |
|---|---|---|---|
| **Where** | Reels · TikTok · Shorts | Reels · TikTok · Shorts | YouTube |
| **Aspect** | 9:16 · 1080×1920 | 9:16 · 1080×1920 | 16:9 · 1920×1080 (no reframe) |
| **Graphics (3)** | top-half graphics, face bottom — full plan | **front hook card only** (`presets/tiktok-raw-style.md`), then raw | liquid-glass panels + takeover/zoom (`presets/liquid-glass-style.md`) |
| **Captions (5)** | centered — **locked** (`presets/captions-style.md`) | low, under face — **locked** (`presets/tiktok-raw-style.md`) | none |
| **Thumbnail** | usually skip | usually skip | **always** (`thumbnail-generator`, alongside render) |

The 9:16 reframe (short-form) happens at the top of Graphics. Exact safe-zone pixel margins +
per-format layout live in [`workflows/short-form.md`](workflows/short-form.md) and
[`workflows/long-form.md`](workflows/long-form.md) — read the matching one before building graphics.

**Short-form safe zones (always, never break):** no key visuals in the **top 200 px** or **bottom
300 px** — the face, captions, and every key graphic stay inside y `200 → 1620`. Those two bands are
background/filler only (platform UI + device chrome sit there).

## Skills

- **Core editing:** `rough-cut`, `graphics-plan`, the locked caption presets (`presets/captions-style.md`,
  `presets/tiktok-raw-style.md` + their `build.py`), `background-music`, `thumbnail-generator`
- **`graphics-plan`** — the step-3a creative-direction skill: reads the rough-cut transcript and
  decides, beat by beat, where graphics go, what kind, and whether a line needs one at all. Outputs
  `projects/<job>/graphics-plan.{json,md}`. It never renders.
- **`to-premiere`** — optional off-ramp after the rough cut (finish by hand in Premiere). Needs the
  `premiere-pro` MCP — optional, see SETUP.md.
- **HyperFrames suite (engine):** `hyperframes` (+ `-core`, `-cli`, `-media`, `-animation`,
  `-creative`, `-registry`) — the HTML-based video toolkit that renders graphics & captions.
- **HyperFrames task workflows (advanced/optional):** `faceless-explainer`, `general-video`,
  `graphic-overlays`, `motion-graphics`, `pr-to-video`, `product-launch-video`,
  `remotion-to-hyperframes`, `slideshow`, `website-to-video`. These are vendored extras for one-off
  builds; the everyday pipeline above doesn't need them. (For short-form captions always use the
  locked presets in step 5.)

### HyperFrames video-authoring toolkit (vendored)

A general HTML-based video toolkit from `heygen-com/hyperframes`, pinned in `skills-lock.json`. It's
the creation engine for **Graphics (step 3b)** and **Captions (step 5)**. The render CLI runs via
**`npx hyperframes`** (auto-downloads on a machine with `node`) — run `npx hyperframes doctor` once to
bootstrap (pin it: `npx hyperframes@0.7.3 doctor`). **Update via the skills registry, not by
hand-editing** — `skills-lock.json` tracks hashes.

## Folder Structure

The project root **is** the editing workspace — job folders live directly in `projects/`.

| Path | What's In It |
|------|--------------|
| `.claude/skills/` | The editing skills + the vendored HyperFrames toolkit |
| `projects/<job>/` | One folder per content piece: raw clips in `raw/`, audio/music in `audio/`, source assets in `assets/`, B-roll in `broll/`, thumbnails in `thumbnails/`, finals in `outputs/`. The HyperFrames graphics build lives **durably** in `hf-graphics/` (its `build.py` + `compositions/` + `parts.json` + a `PROJECT.md` resume doc — never delete this; it's the real progress). Only the **regenerable** cache (`renders/`, base slices, font copies) is disposable. **Nothing lives solely in `/tmp`** — it's volatile on every platform (macOS clears it; WSL clears it on restart) and it wiped a whole build once. `prune.sh` reclaims the cache when a job ships. |
| `finalize.sh` | The **export** step (step 7). `./finalize.sh <job>` promotes the latest render to the one canonical `outputs/<job>.final.mp4` and retires drafts, keeping the base cut + transcript + `hf-graphics/` source for re-editing. Dry-run by default; `--apply` to act. |
| `prune.sh` | Reclaims space in `projects/` (dry-run by default; `--apply` to delete). |
| `assets/` | Shared generation assets — `face-refs/` (your face, for thumbnails), `fonts/`, `logos/`, YT thumbnail templates. **Personalize:** drop your own face refs + logos here (see each folder's README). |
| `brand-kit.md` | The one file you fill in — your identity, voice, colors, fonts, hook style. |
| `skills-lock.json` | Pins the vendored HyperFrames skills (source + hash). |
| `check-setup.sh` | Report-only check of the system tools the editing skills need (ffmpeg, etc.). |

**Job naming:** name `<job>` after the video's content — a short kebab-case title (e.g.
`my-first-video`, `cold-dm-teardown`), **never** the camera file (`C1840.MP4`), a date, or a stage suffix.

## Rules

- **One job: edit the best video possible.** Raw → fully edited → exported. No business/CTA logic
  lives here — captions and end screens carry no sales asks.
- **Surgical changes only.** Touch what's asked. Don't "improve" adjacent renders or refactor
  working skills.
- **Update HyperFrames via the registry,** not by hand — `skills-lock.json` tracks hashes.
- **Document, don't manufacture.** Authenticity outperforms.
- **Repeated line across takes → use the LAST take.** Don't ask.
- **Captions run the whole video by default** — never suppress them under a hook or graphic unless told.

## Lab Notes — how the locked presets work

These are engineering notes from the original build of this system — the *why* behind the locked
presets, so you can extend them without re-discovering the gotchas. Any job names that appear are
worked examples from that build.

- **Transcribe ONCE per video.** WhisperX large-v3 is the single transcription for the whole pipeline
  (most accurate, so it's the source of truth). `rough-cut` persists it to
  `projects/<job>/transcript/words.json` and reuses forever (`--force` to redo). Finishing/captions do
  NOT re-transcribe: `splice.sh` derives `outputs/<job>.transcript.json` by remapping kept words
  through `cuts.json` (pure arithmetic). **Spelling/brand fixes are applied right there** — as it
  writes the canonical transcript, `export-transcript.py` runs `presets/caption-corrections.json` over
  it, so the fix reaches graphics-plan AND both caption formats AND long-form (the raw `words.json`
  stays untouched). The locked caption builders (step 5) read that already-corrected canonical
  `outputs/<job>.transcript.json` directly. The WhisperX venv builds once and is reused across jobs.
- **Explainer captions = LOCKED preset.** Standard burn-in for talking-head explainers lives in
  [`presets/captions-style.md`](presets/captions-style.md) + builder
  [`presets/captions/build.py`](presets/captions/build.py). Coolvetica Regular 49px, white on a
  solid-black box, dead-centered on the frame seam (y960), box pre-sized to the full phrase, words pop
  in per-word on their own WhisperX timestamp (on-beat karaoke). **The timing lock:** build captions
  ONLY from the canonical `outputs/<job>.transcript.json` and overlay onto the render that ships —
  same timeline → on-beat with zero manual nudging. Brand mishears are already fixed upstream by
  [`presets/caption-corrections.json`](presets/caption-corrections.json) (applied to the canonical
  transcript at splice time — see the transcribe-once note above), so captions inherit them.
- **TikTok/raw = LOCKED preset.** Hook card + line captions live in
  [`presets/tiktok-raw-style.md`](presets/tiktok-raw-style.md) + builder
  [`presets/tiktok-raw/build.py`](presets/tiktok-raw/build.py). Hook card = Inter Bold 64px
  black-on-white-box, sized to the ink extents (not font metrics), pinned top (y250), shown only over
  the spoken hook (auto-ends on a configured trigger word or `--hook-end`); captions = Inter Bold
  42px white + 4px black stroke, no box, no animation, line-by-line, low under the face (y1500).
  **Captions are ALWAYS ON** the whole video — the hook card overlays on top, never replaces them.
  Engine = PIL PNG overlays + ffmpeg `overlay` enable-timing (this ffmpeg has no freetype/libass, so
  PIL is the house pattern). Deliverable = `outputs/<job>.final.mp4` (keep `outputs/<job>.mp4` as the
  clean base the builder reads from — don't overwrite, or you'll caption an already-captioned video).
  **Gotcha:** the `-loop 1` PNG overlay inputs never EOF, so the output MUST be bounded with `-t`
  (source duration) — the builder always passes it.
- **Explainer face framing = LOCKED: hair top 50 px below the seam, measured not guessed.** Before
  building split-frame explainer graphics, run
  `uv run workflows/face-frame.py projects/<job>/outputs/<job>.mp4`. It samples ~12 frames of the base
  cut, detects the face (OpenCV YuNet — model bundled at `assets/models/`), finds the true hair top via
  median-background subtraction (works even with dark hair on a dark room), and prints the exact
  `object-position` for the `#head` cover-crop → also written to `projects/<job>/face-frame.json`. If
  the source is still 16:9 it prints the face-centered ffmpeg crop for the 9:16 reframe too. Fallback
  when hair can't be measured (hat/hood): face-box center → y1385. After the draft render,
  `uv run workflows/face-frame.py --verify <render>` must print ✓ PASS before review. First run
  auto-installs the OpenCV dependency via `uv` (one time, needs internet).
- **Full-video explainer graphics = GENERATE the composition, don't hand-author it.** A ~2-minute
  explainer is ~20+ graphics — too many clips to hand-write reliably. Pattern: a `build.py` reads the
  `graphics-plan` and emits `index.html` from ~10 templates (title-card / stat / checklist / ranked /
  iconrow / screenshot-card / diagram / engine). Bottom-half talking head = the full rough cut
  cover-cropped into y960–1920 (track 0); top half = a persistent background clip + each graphic a
  windowed clip on alternating `data-track-index`; one master paused GSAP timeline with absolute
  times. Gotchas: (1) every exit fade that ends on the next clip's start boundary needs a
  `tl.set("#id",{opacity:0}, end)` hard-kill or HyperFrames pops the transition; (2) keep the graphic
  stage at y200–880 so it stays inside the safe box AND clear of the centered-caption seam (~900–1080).
- **Incremental graphics = render PART-BY-PART, composite with ffmpeg.** The second-pass tweak loop
  doesn't re-render the whole video per change. Full doc:
  [`workflows/incremental-graphics.md`](workflows/incremental-graphics.md). A parts-oriented `build.py`
  emits one composition PER graphic + `render-part.sh <id>` + `assemble.sh`. Two part kinds: **overlay**
  (floats over footage → render standalone as a transparent `.mov` via `--format mov`) and **segment**
  (modifies the footage itself → render opaque `.mp4` carrying its own base slice). `assemble.sh` is
  ONE ffmpeg pass chaining base + each part with `-itsoffset` + `overlay=enable='between(...)'`. Loop =
  edit `build.py` → render only the changed part (~30–50s) → assemble (~5s) → review. The base rough cut
  is NEVER re-rendered. Render every part at the base fps (e.g. `--fps 24000/1001` for 23.976) or frames
  drift through ffmpeg. The win is modest on a short reel but compounds hard on long-form.
- **Render cut drift.** A rendered base can drift ~0.4s from the nominal cut timeline; anchor footage
  zooms/cuts to MEASURED scene-cut times (ffmpeg `scdet`), not the nominal `cuts.json` times.
- **`prune.sh`** reclaims space in `projects/` — deletes only regenerable dead weight (HyperFrames
  `work-*` render scratch, stray `node_modules`, intermediate renders; keeps `*final*`/`*graphics*` +
  highest `-vN`). Never touches source `raw/*.mp4` or `outputs/`. Dry-run by default; `--apply` to
  delete. The space hog is raw footage + leftover render scratch.
