---
name: ig-competitor-research
description: "Scans Instagram + TikTok competitors via the tokscript MCP (get_instagram_user_reels / get_tiktok_user_videos), then deep-breaks-down the winners. Pulls each handle's last-week short-form videos, keeps the top 3 by likes per handle, pools and ranks the whole set by likes (3 handles = 9 videos, 5 = 15), surfaces real view counts, and scores each video's breakout (its likes vs that creator's own weekly median) so true outliers surface regardless of account size. Then fans out one subagent per video: each resolves a direct link via tokscript download_video (works for both IG and TikTok), downloads it, Whisper-transcribes it locally, and analyzes keyframes. Each video is broken down into hook (+ hook type: spoken vs on-screen text), content format (talking head / listicle / side-by-side / reaction / …), full transcript, a one-line concept breakdown, and why it worked. Builds a self-contained, visual HTML report (media auto-fits each video's real aspect ratio — no black bars — keyframe galleries, one-click-copy transcripts, breakout badges, view-count pills, View-original links) in research/ and opens it automatically. Triggers: content research, competitor research, what's trending, niche research, research competitors, find outliers, trending content, what's working in my niche, tiktok research, instagram research."
---

# Competitor Research — Top 3 / Handle, Transcribed + Visually Broken Down (IG + TikTok)

Three phases, and the orchestrator (you) stays light the whole way — **scripts do the ranking, scoring, formatting, media routing, and report assembly; you never sort videos in your head, hand-format a date, hand-author the report manifest, or pull media blobs into context.**

- **Phase 1 — Scrape & prep:** one tokscript listing call per handle (`get_instagram_user_reels` for IG, `get_tiktok_user_videos` for TikTok) → pool the items to disk → `rank-and-select.py` ranks the videos by likes, surfaces view counts, scores each one's **breakout** (likes vs its creator's weekly median), picks the winners, and writes `selection.json` + scatters each video's permalink into its job dir.
- **Phase 2 — Break down:** one Sonnet subagent per pick resolves a direct video link via tokscript `download_video`, downloads it, transcribes it locally (Whisper), analyzes keyframes, and **writes `<jobdir>/post.json`** (the analysis). Heavy media never touches your context.
- **Phase 3 — Build:** you write one `pattern.txt` synthesis line; `build-report.py` assembles `selection.json` + every `post.json` + `pattern.txt` into a self-contained, visual HTML report and opens it.

**Both platforms compete in one pool.** IG reels and TikTok videos are ranked together — top video is top video, whichever platform. Each pick is tagged with its source and routed to the same reel-breakdown branch (tokscript `download_video` auto-detects the platform from the URL).

**Ranking is by LIKES.** Comments break ties; hidden likes (`-1`) sort last. tokscript also returns **view counts** (IG views, TikTok plays), carried through and shown as a pill on every card — but likes stays the rank key for stability (views can be null on some posts, and likes is the consistent engagement signal). `rank-and-select.py` enforces all of this; don't re-derive it.

**Breakout score = likes ÷ that creator's weekly median.** Per-creator, so a small account's overperformer isn't buried under a big account's median-level post. Computed in `rank-and-select.py`, shown as a 🔥/📈 badge on every card. (Ranking still uses raw likes — breakout is a surfaced signal, not the sort key.)

**Claude reads the media directly.** Keyframes are analyzed in-house by the subagents (native multimodal Read) — no external vision API, no extra key.

**Auth is the tokscript MCP's OAuth — no token, ever.** Never look for an API key, never ask the user to paste or `export` one. Profile scraping (`get_instagram_user_reels` / `get_tiktok_user_videos`) requires a tokscript **Pro/Premium** plan; the free tier can't list a profile.

---

## PHASE 1 — Scrape & Prep (you, the orchestrator)

1. **Resolve handles.** Read `competitor-list.md`. It can have an `## Instagram` section and/or a `## TikTok` section — extract handles from the `instagram.com/handle/` and `tiktok.com/@handle` URLs in each. **Default to the first 5 handles total** (order = priority — don't ask), tagging each with its platform. Inline handles override the default (a bare `@name` defaults to the section it's nearest, or ask if ambiguous — e.g. "research the tiktok @x and ig @y"). "all" uses every handle. If both sections are empty and no inline handles, ask.
2. **Stamp a unique run.** Run `date +%Y-%m-%d_%H%M%S` once and call it `<RUN>`. `<RUN_DIR>` = `/tmp/ig-research/<RUN>/`; `mkdir -p` it. Final report = `<project_root>/research/Competitor-Research_<RUN>.html` (create `research/` if missing). **Every run is its own isolated dir + report file** — the timestamp guarantees zero collision, so never inspect, reuse, wipe, or worry about a prior run.
3. **Scrape each handle (tokscript MCP), by platform.**
   - **Instagram handles** → `ToolSearch` → `select:mcp__tokscript__get_instagram_user_reels`, then call it with `username: "<handle>"`, `count: 20`.
   - **TikTok handles** → `ToolSearch` → `select:mcp__tokscript__get_tiktok_user_videos`, then call it with `username: "<handle>"`, `count: 20`.

   Both list the handle's recent short-form videos with per-video stats — **likes, comments, views/plays, duration**, permalink, thumbnail. Neither extracts transcripts (we do that locally with Whisper) and neither burns per-video quota — it's one profile-listing call per handle. Follow `next_cursor` as `cursor` only if you need deeper coverage; for last-week research one page of 20 is plenty.

   **Pool every handle's items into ONE array on disk** at `<RUN_DIR>/dataset.json`. Each tokscript result may come back inline or spilled to a `tool-results/…txt` file:
   - **Spilled** (the harness returns a file path): extract items straight to disk with `jq` — never read the blob into context. If items live under a key, select it (`.results // .videos // .reels // .items // .`), and append each handle's items into the combined array. Merge N handle-files into one:
     ```bash
     jq -s 'add' "<RUN_DIR>/h1.json" "<RUN_DIR>/h2.json" … > "<RUN_DIR>/dataset.json"
     ```
   - **Inline** (a light account): write the items verbatim to `<RUN_DIR>/dataset.json` with the Write tool.

   `rank-and-select.py` reads fields defensively — it already tolerates **both** IG (`likesCount`/`videoViewCount`/`ownerUsername`) and TikTok (`diggCount`/`playCount`/`author.uniqueId`) key names — so you don't reshape records; just get the **raw items**, pooled, onto disk. `<N>` = `jq 'length' "<RUN_DIR>/dataset.json"`.
4. **Rank, score & prep (ONE script — no in-head sorting).** Run:

   ```
   python3 <SKILL_DIR>/scripts/rank-and-select.py "<RUN_DIR>/dataset.json" "<RUN_DIR>" --per-handle 3 --expect "handle_a,handle_b,handle_c" --expect-count <N>
   ```

   It groups by handle, ranks by likes (hidden last, ties by comments), keeps the top 3 per handle, pools and sorts the whole set, surfaces each pick's **view count** and **breakout score** (likes ÷ that handle's weekly median), then writes `<RUN_DIR>/selection.json` and scatters each pick's permalink into `<RUN_DIR>/<rank>_<handle>/posturl.txt` (plus `videourl.txt`, pre-filled only if the listing already carried a direct video URL). It prints a ranked table (likes, views, breakout) and flags any pick with a missing permalink or any `--expect` handle that returned nothing. **`--expect-count <N>`** hard-errors if `dataset.json` doesn't hold exactly `<N>` items. **Read its stderr** — relay the table and note any empty handle in the Pattern line later. (Stdlib only — plain `python3`, no `uv`.)

Then go to Phase 2. You now have `selection.json` (small) as your single source of truth — you never touched a media blob.

---

## PHASE 2 — Break Down Each Video (fan out: one subagent per pick)

Read `<RUN_DIR>/selection.json`. For each pick, spawn a **Sonnet subagent** (Agent tool, `subagent_type: "general-purpose"`, `model: "sonnet"`), choosing the template by `format`. **Spawn them in parallel — batch the Agent calls in single messages** so they run concurrently. Each subagent resolves + downloads its media into the job dir, analyzes it, **writes `<jobdir>/post.json`**, and returns one short status line.

`<SKILL_DIR>` = this skill's own folder — use the absolute "Base directory for this skill" path shown when the skill launches (do **not** hardcode a machine-specific path). Substitute it, and every other `<…>`, with the real value from `selection.json` before spawning.

**Reel / Video** (`format` is `Reel` or `Video` — IG reels AND TikTok videos both land here) — prompt template:

> You are breaking down ONE short-form video (Instagram reel or TikTok) for a competitor-research report.
> Post: rank #<rank>, @<handle>, <likes> likes, <views> views, <comments> comments, posted <date>.
> Permalink: <url>
> Job dir: <jobdir>
>
> 1. **Resolve the direct video link.** Read `<jobdir>/videourl.txt`. If it's empty or not an `http…` URL, load `ToolSearch` → `select:mcp__tokscript__download_video`, call `mcp__tokscript__download_video` with `video_url` = the permalink above (the contents of `<jobdir>/posturl.txt`) — it auto-detects IG vs TikTok — take the **direct download URL** from the response, and write it (one line, nothing else) to `<jobdir>/videourl.txt` with the Write tool.
> 2. Run exactly:
>    `bash <SKILL_DIR>/scripts/reel-breakdown.sh "<jobdir>" "$(cat "<jobdir>/videourl.txt" 2>/dev/null)"`
>    (curls the video from that direct URL, grabs keyframes at 1s/2s/3s/midpoint, transcribes locally with faster-whisper small.en.)
> 3. Read `<jobdir>/transcript.md` and every `<jobdir>/frame_*.jpg` (the Read tool renders images — actually look at them). Leave every file in place; delete nothing.
> 4. Write `<jobdir>/post.json` using the Write tool, as VALID JSON with exactly these keys:
>    `{"rank": <rank>, "hook": "<the opening hook — the first spoken line verbatim from transcript.md, OR the on-screen text hook if a text overlay carries the open>", "hook_type": "<spoken | on-screen text | spoken + text — judge from frame_01s/02s/03s>", "content_format": "<the content format in 2-4 words: talking head, listicle, side-by-side comparison, reaction, screen-recording demo, voiceover b-roll, etc.>", "transcript": "<full transcript, one paragraph, verbatim>", "breakdown": "<ONE sentence: what the whole video actually is / its concept>", "why": "<1-2 sentences grounded in the hook + format + transcript — the actual mechanic, not generic praise>"}`
>    Make sure it parses: escape inner quotes, no trailing commas, keep each value on one line. If the download failed, set "transcript" to "(unavailable)", "hook_type"/"content_format" to "(unknown)", infer "hook"/"breakdown"/"why" from the caption, and still write the file.
> 5. Return ONLY one status line, nothing else:
>    `OK #<rank> @<handle> Reel | hook: <hook, ≤12 words> | why: <why, ≤18 words>`
>    (or `FAIL #<rank> @<handle> Reel | <one-line reason>` if the download failed.)

**Carousel / Image** (`format` is `Carousel` or `Image` — only if you fed the skill IG `get_instagram_user_posts` output) — prompt template:

> You are breaking down ONE Instagram <carousel|image> for a competitor-research report.
> Post: rank #<rank>, @<handle>, <likes> likes, <comments> comments, posted <date>.
> Permalink: <url>
> Job dir: <jobdir>
> Caption: <caption>
>
> 1. Run exactly (the image URLs are saved one-per-line in the job dir):
>    `bash <SKILL_DIR>/scripts/fetch-images.sh "<jobdir>" $(cat "<jobdir>/imageurls.txt")`
> 2. Read every `<jobdir>/slide_*.jpg` in order (the Read tool renders images — actually look at them). Leave every file in place; delete nothing.
> 3. Write `<jobdir>/post.json` using the Write tool, as VALID JSON with exactly these keys:
>    `{"rank": <rank>, "hook": "<slide-1 headline / main on-image text>", "hook_type": "on-screen text", "content_format": "<the carousel format in 2-4 words: listicle, step-by-step, tips, story/narrative, side-by-side comparison, single graphic/quote, etc.>", "transcript": "<the full text content of every slide in order, verbatim and copy-pasteable; for a single image, its text>", "breakdown": "<ONE sentence: what the whole carousel actually is / its concept>", "why": "<1-2 sentences grounded in what's actually on the slides>"}`
>    Make sure it parses: escape inner quotes, no trailing commas, keep each value on one line. If the download failed, set "transcript" to "(unavailable)", "content_format" to "(unknown)", and infer "hook"/"breakdown"/"why" from the caption.
> 4. Return ONLY one status line, nothing else:
>    `OK #<rank> @<handle> <Carousel|Image> | hook: <hook, ≤12 words> | why: <why, ≤18 words>`
>    (or `FAIL #<rank> @<handle> <Carousel|Image> | <one-line reason>` if the download failed.)

---

## PHASE 3 — Build the HTML Report & Open It (you, the orchestrator)

1. **Write the Pattern line.** From the returned status lines (hook + why per pick), write **3-4 short, punchy sentences MAX** on what repeats across the pool — lead with the takeaway, no preamble, scannable in ~5 seconds. Hit the highest-signal threads only (dominant hook archetype, the format/mechanic that recurs, the real engagement driver, the topic cycle, the biggest breakout, any IG-vs-TikTok split worth noting). Don't catalog every video or quote every stat. Note any handle `rank-and-select.py` flagged as empty. Put it in **one `Write` call** to `<RUN_DIR>/pattern.txt` (plain text). This becomes the report's "Pattern" block — keep it tight.
2. **Assemble + render + open (ONE command).** Run:

   ```
   uv run --quiet --with pillow python <SKILL_DIR>/scripts/build-report.py "<RUN_DIR>" "<project_root>/research/Competitor-Research_<RUN>.html" --open
   ```

   Pointed at the **directory**, `build-report.py` assembles the manifest itself — `selection.json` is authoritative for the scraped + computed facts (rank, handle, format, likes, comments, views, date, url, breakout), each `<jobdir>/post.json` supplies the analysis, `pattern.txt` supplies the synthesis — then downscales + base64-embeds all media, writes the HTML (with breakout + view badges), leaves an inspectable `manifest.json` in `<RUN_DIR>`, and `--open` pops it in the browser. It **warns on stderr if any pick was missing a usable `post.json`**.
3. **If a pick was flagged missing**, re-spawn just that one subagent, then re-run the build command. Otherwise you're done.
4. **Report the file path** back to the user — `research/Competitor-Research_<RUN>.html` — plus the ranked table (likes, views, breakout) and the one-paragraph pattern.

RULES:
- The **hook is never the caption.** Reel/TikTok hook = the host's first spoken line from the transcript (or the on-screen text hook if a text overlay carries the open); carousel/image hook = the slide-1 text. Each post also records `hook_type`, a 2-4 word `content_format`, a one-sentence `breakdown`, the full `transcript`, and `why`. The subagents capture all of this — don't override it.
- **Why it worked is grounded** in the real transcript + frames. One sharp mechanic beats a paragraph of praise. Never invent an engagement rate or a view count — use the real numbers from `selection.json`.
- HTML is the only output. No markdown report. Scraped + computed facts always win over a subagent's echoed numbers (the builder enforces this).

---

## Rules of Thumb
- **One tokscript listing call per handle (OAuth, no token), then everything's local.** IG → `get_instagram_user_reels`; TikTok → `get_tiktok_user_videos`. Pool to `<RUN_DIR>/dataset.json` → `rank-and-select.py` ranks + scores + preps. The profile listing requires a tokscript **Pro/Premium** plan. No Apify, no Chrome MCP, no Playwright, no API token.
- **IG + TikTok rank in one pool.** All short-form videos compete by likes; breakout normalizes per creator so a small TikTok account's outlier can still top a big IG account's median post.
- **Scripts own the mechanical work, you own the judgment.** `rank-and-select.py` ranks + scores + preps; subagents resolve/download/transcribe and write `post.json`; `build-report.py` assembles + renders. You only resolve handles, stamp the run, fire the per-handle scrapes, fan out, and write one Pattern line.
- **Default 5 handles total, top 3 each.** Order in `competitor-list.md` = priority (across both sections). A handle with no videos in the window contributes fewer (flagged by `--expect`).
- **Rank by likes; surface views + breakout.** Comments break ties. `-1` = hidden, sorted last. tokscript gives real view/play counts → shown as a pill. Breakout = likes ÷ that handle's weekly median; a kept post with hidden likes shows `—`. All computed in `rank-and-select.py`.
- **Subagent resolves its own video → `reel-breakdown.sh "<jobdir>" "$(cat <jobdir>/videourl.txt)"`** (tokscript `download_video` on the permalink — IG or TikTok — → direct link → curl + ffmpeg keyframes + faster-whisper `small.en`). Whisper override: `WHISPER_MODEL=medium.en`.
- **Transcription is local Whisper, not tokscript.** tokscript supplies the *listing* + the *download link*; the video's audio is transcribed on your machine with faster-whisper. Keeps the breakdown self-contained and the transcript verbatim.
- **Subagents do the media, not you.** One Sonnet agent per pick, in parallel; heavy video work (download, ffmpeg, Whisper) stays out of the orchestrator context.
- **Claude reads the frames directly** — no external vision provider.
- **Output is a self-contained HTML report** built by `build-report.py` (Pillow downscales + base64-embeds every frame — portable, no asset folder, no expiring links). Keyframe galleries, collapsible transcripts, breakout badges, view-count pills, "View original" buttons, 🔬 favicon. `--open` pops it in the browser (macOS `open`).
- **Resilient assembly.** A pick whose `post.json` is missing/malformed still renders (media + facts + breakout + views), flagged on stderr — re-spawn that one subagent and re-run the build.
- Intermediates live in `<RUN_DIR>` = `/tmp/ig-research/<RUN>/` — timestamped, fully isolated: no collisions, nothing to clean. The HTML in `research/` is the durable artifact.
