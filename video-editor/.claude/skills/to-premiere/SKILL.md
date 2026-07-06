---
name: to-premiere
description: "Optional off-ramp from the pipeline — hand the rough cut to Adobe Premiere Pro so you can finish editing there by hand instead of continuing in HyperFrames. Rebuilds the rough cut AS separate, trimmable clips on the Premiere timeline — it replays the edit decision list (cuts.json) against the raw footage, NOT a single flattened export — so every cut is a real edit point you can ripple/slip/slide. Triggers: send to premiere, open in premiere, finish in premiere, hand off to premiere, add the rough cut to premiere, edit this in premiere, take it into premiere."
---

# To Premiere — Rough Cut Handoff

An **optional off-ramp**, not a pipeline stage. After the rough cut (pipeline step 2) you normally continue into Graphics/Captions in HyperFrames. This skill is the *other* door: drop the finished rough cut into a ready-to-edit Premiere Pro project so you finish the rest by hand.

It does exactly one thing: get the cut **onto a Premiere timeline, ready to edit.** Nothing more — no graphics, no captions, no render. Those happen in Premiere now.

**The cut is rebuilt AS cuts — not dropped in as one flat clip.** This is the whole point of the hand-off. The rough-cut skill already decided every edit (which raw clip, in/out points) and saved it as an EDL (`cuts.json`). This skill *replays* that EDL against the **raw footage**: each kept segment becomes its own clip on V1, end-to-end, landing at the exact same edit points the rough cut produced. So you open Premiere to the same tight cut you approved — but every boundary is a real edit point you can ripple, slip, slide, or re-trim against the original takes. Importing the flattened `outputs/<job>.mp4` as a single clip is the *fallback*, not the path (see Fallback below).

## When to use
- you say any trigger phrase above, OR
- A rough cut exists and you want to finish manually in Premiere instead of HyperFrames.

If there's no rough cut yet, run `rough-cut` first. (You *can* import raw footage instead if you explicitly asks, but the point of this handoff is the tightened cut.)

## What it needs first — the bridge must be live

This skill drives Premiere through the **`premiere-pro` MCP server** (wired in `.mcp.json`). That server only does anything when Premiere is open with the bridge panel running.

1. **MCP tools available?** The `premiere-pro` tools (`mcp__premiere-pro__*`) load at Claude Code session start. If you don't see them, the `.mcp.json` was added after this session began — tell you to **reconnect/restart Claude Code** once, then retry.
2. **Bridge connected?** Call `ping` first. If it errors or times out, the panel isn't running. Tell you, in one line:
   > Open Premiere Pro → **Window → Extensions → MCP Bridge** → set Temp Directory to `/tmp/premiere-mcp-bridge` → click **Start Bridge** (green "Running").
   Then retry `ping`. Don't proceed until it returns ok.

The temp dir in the panel **must match** `PREMIERE_TEMP_DIR` in `.mcp.json` (`/tmp/premiere-mcp-bridge`) — that shared folder *is* the bridge.

## Procedure

1. **Resolve the job.** Newest folder under `projects/` unless you named one.
2. **Locate the EDL + raw footage.** The EDL is `projects/<job>/transcript/cuts.json` (persisted durably by `splice.sh`); if it's missing there, check `/tmp/video-editor/<job>/cuts.json`. The raw clips are in `projects/<job>/raw/`. **Both must exist** — they're what we replay. If `cuts.json` is gone from both spots, you can't rebuild the cuts; take the **Fallback** path instead and tell you why (the EDL wasn't persisted for this older job).
   - Read `cuts.json`. It's `{ "segments": [ { "clip": "clip-01.mov", "start": 1.24, "end": 4.60, "transcript": "..." }, ... ] }`. Segment order = timeline order. `start`/`end` are seconds **in the raw clip** (raw timeline), which is exactly what the Source Monitor in/out points take.
3. **Preflight** the bridge (`ping`) per above.
4. **Create the project** at `projects/<job>/premiere/<job>.prproj` (`create_project`). If it already exists, `open_project` it instead of clobbering your in-progress work — ask if unsure.
5. **Import the raw clips** (`import_media`) — every distinct `clip` referenced in `cuts.json`, from `projects/<job>/raw/`. (Not the flattened `outputs/<job>.mp4` — that's the fallback only.) Note each imported item's id/name for the Source Monitor.
6. **Build a matching sequence.** Read a raw clip's dimensions/framerate (`get_full_clip_info` or `get_item_info`) and `create_sequence` so settings match the footage — **9:16 1080×1920** for short-form, **16:9 1920×1080** for long-form. Don't drop vertical footage into a 16:9 sequence; match the source.
7. **Replay the EDL onto V1 — one segment at a time, in order.** This is three-point editing, the same move a human editor makes. For each segment:
   1. `open_in_source` the segment's raw clip (`item_id` = the imported clip's id/name).
   2. `set_source_in_out` with `in_seconds = segment.start`, `out_seconds = segment.end`.
   3. `overwrite_from_source` onto `video_track_index: 0` (V1). An overwrite edit advances the playhead to the end of the clip it just laid down, so the next segment appends seamlessly — the segments end up butted end-to-end with no gaps, in EDL order.
   - **Result:** N separate clips on V1, each a real edit point. you can ripple/slip/slide/re-trim any of them against the full raw take — the original heads and tails are still there in the source, just trimmed off by the in/out.
   - If the playhead ever doesn't auto-advance as expected (bridge quirk), fall back to computing the cumulative timeline position (sum of prior segment durations) and `set_playhead_position` before each `overwrite_from_source` — but try the auto-advance path first; it's how overwrite is meant to work.
8. **Save** (`save_project`) and confirm: report the `.prproj` path, the segment count on V1, and that the rough cut is rebuilt as individual edits ready for you to fine-tune in Premiere.

## Fallback — flat clip import

Only when the EDL is unavailable (old job, `cuts.json` lost from both durable and `/tmp` spots) or you explicitly asks for "just the flat cut as a reference":

1. `import_media` the `outputs/<job>.mp4`.
2. `create_sequence` matching its dimensions/framerate.
3. `add_to_timeline` at the start of V1 (one clip).
4. Save and tell you it's the **flattened** cut — the individual edit points aren't recoverable, so re-trims mean razoring by eye. If you want real edit points, re-run `rough-cut` so a fresh `cuts.json` gets persisted, then hand off again.

## Notes
- This is the finish line for *this* repo when the off-ramp is taken — what happens after (graphics, color, export) is your manual Premiere work, by design.
- Keep it surgical: import raw + matching sequence + the EDL replayed onto V1. Don't pre-build graphics or captions in Premiere unless asked.
- **Why rebuild from the EDL instead of importing the flat MP4?** So the cuts are *real edit points*, not baked pixels. A flattened clip forces you to razor by eye to adjust any boundary; replaying the EDL gives you every cut as a trim handle with the full raw take behind it. This path is rare (most jobs finish in HyperFrames) but when it's taken, it's the editor-grade hand-off.
- **Audio rides along.** `overwrite_from_source` lays the clip's audio onto A1 in lockstep — no separate audio step. The EDL's segments stay A/V-synced because in/out points apply to the source clip as a whole.
- The MCP exposes 266 tools (track targeting, effects, markers, export, etc.). Run `get_project_info` to discover state when you need more than the basic handoff.
- Engine: `premiere-pro-mcp` (npm, leancoderkavy/ppmcp) → CEP/ExtendScript bridge. Reinstall the panel with `premiere-pro-mcp --install-cep` if Premiere stops seeing it.
