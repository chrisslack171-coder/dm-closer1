---
name: seedance-2-shlabu-prompt-bot-30s
description: "Generate structured AI video prompts for Seedance 2.0 at extended length — up to 30 seconds. Trigger this skill any time the user wants to produce a longer video prompt, build a shot list, plan out a video sequence, or describe a visual concept for AI generation that runs beyond 15 seconds — including when Seedance is mentioned alongside a 20s, 25s, 30s, half-minute, or \"long\" duration. Also activate when the user describes a scene, ad concept, brand film, product video, or any extended visual sequence that needs to be translated into generation-ready prompts, even if they never say \"video prompt\" explicitly. Trigger on phrases like \"30 second video prompt,\" \"longer Seedance prompt,\" \"extended shot list,\" \"plan a 30s video,\" \"long-form video concept,\" \"create a longer sequence,\" \"30 second brand film prompt,\" \"30s ad prompt,\" or any description of what should happen in a longer video that needs to be turned into structured prompts."
---

# Video Prompt Bot for Seedance 2.0 — 30 Second Edition

Build cinematic video prompts from a creative brief — whether that's a single continuous shot or a multi-shot sequence — at extended length up to 30 seconds. Every output follows a structured effects breakdown format designed to give Seedance 2.0 maximum detail on camera work, effects, pacing, and motion flow.

## How this skill works

1. The user provides a **creative brief** — this can be as simple as "a runner in a stadium for a Nike-style ad" or as detailed as a full storyboard description. They may also provide a reference video, mood, brand context, or specific effects they want.
2. Read the reference file at `references/effects-breakdown-reference.txt` to internalise the structure and level of detail expected.
3. Generate a complete video prompt in plain text, structured into the four mandatory sections below.

## Input expectations

The user's brief can include any combination of:
- Subject/talent description (who or what is on screen)
- Setting/environment
- Mood, tone, energy level
- Brand or product context
- Specific effects or camera moves they want
- Duration target
- Reference to existing ads, films, or visual styles
- Colour palette or grade preferences
- Reference images (photos, stills, mood boards)

If the brief is too vague to build a full prompt (e.g. "make something cool"), ask one focused clarifying question before proceeding. Don't over-interrogate — work with what you're given and make creative decisions where the user hasn't specified.

## Reference image handling

When the user provides reference images, **always open the prompt with an IMAGE REFERENCE MAP** before any other section. This block clarifies which image is playing which role in the prompt, based on what the user told you.

Format:
```
📎 IMAGE REFERENCE MAP
• Image 1 ([filename or position]) → [role: e.g. subject/character, environment, lighting reference, color grade, product, etc.]
• Image 2 ([filename or position]) → [role]
• Image 3 ([filename or position]) → [role]
```

Use the user's own language to describe the role — if they said "this is the background", write "background environment." If they didn't specify a role for an image, infer it from context and note it as "(inferred)". This section should appear before Section 1 and always precede the shot-by-shot timeline.

## Detecting existing clip edits — COMPOSITE / EDIT MODE

Before building any prompt, determine whether the user is asking to **create a new video from scratch** or **modify/add something to an existing clip**.

**Signals that this is an existing clip edit:**
- User uploads a video file alongside the brief
- Phrases like: "keep everything the same but...", "add X to this clip", "composite X into this video", "replace X in the existing footage", "this clip already exists", "don't change the footage", "insert", "overlay", "place X into the video"
- The brief describes only one new element being introduced into an otherwise complete scene

**If it IS an existing clip edit — use COMPOSITE MODE:**

Do NOT generate the full four-section prompt. Instead output:

1. **IMAGE/VIDEO REFERENCE MAP** (same format as above — list all assets and their roles)
2. **COMPOSITE BRIEF** — a single focused block in plain prose describing:
   - What the base footage is and that it is retained exactly as-is
   - What is being added, changed, or composited in
   - Precise placement, timing, and world-space vs screen-space behaviour
   - Light integration, shadow, and how the new element relates to the existing scene
   - Any animation or motion behaviour of the new element
   - Whether it is present from frame one or has a specific entry point

No timeline sections. No density map. No motion flow. The base footage already handles all of that — the prompt only needs to describe the delta.

**If it is NOT an existing clip edit — use FULL PROMPT MODE:**

Proceed with the standard four-section output below.

---

## Output structure

ALWAYS output ALL FOUR sections in this exact order. Never skip a section.

### Section 1: EFFECTS TIMELINE

This is the core of the prompt. Structure it based on what the brief actually calls for — do not default to a fixed number of shots or cuts. The brief determines the structure:

- **Single continuous shot**: One block covering the full duration, broken into timestamped moments (e.g. what happens at 0s, 3s, 7s, 12s, 20s, 27s)
- **Multi-shot sequence**: One block per shot, ordered chronologically
- **Mixed**: A hero continuous shot with one or two cuts — follow the brief

Each block is structured like this:

```
SHOT [N] / MOMENT ([timestamp]) — [Name / Description]
• EFFECT: [Primary effect name] + [secondary effects if stacked]
• [Detailed description of what's happening visually]
• [Camera behaviour — angle, movement, lens if relevant]
• [Speed/timing information]
• [How this moment transitions or flows into the next]
```

Guidelines:
- Never pre-assign a shot count. Let the brief dictate whether it's 1 shot or 10
- Name effects precisely: "speed ramp (deceleration)" not just "speed ramp"; "digital zoom (scale-in)" not just "zoom"
- Describe stacked effects explicitly — if 3 things happen at once, list all 3
- For continuous shots, treat transitions as internal momentum shifts, not cuts
- Use language Seedance 2.0 can interpret: describe the visual result, not the editing software technique. For example, say "the frame scales inward rapidly" rather than "apply a keyframed scale effect in After Effects"
- Note the most impactful or signature moment with a callout like "This is the SIGNATURE VISUAL EFFECT"
- Be specific about speed percentages when using slow-motion (e.g. "approximately 20-25% speed")
- Describe motion blur, light behaviour, and atmospheric effects where relevant

### Section 2: MASTER EFFECTS INVENTORY

A numbered list of every distinct effect used across the full prompt, with:
- Effect name
- How many times it's used (e.g. "used 3x")
- Which shots it appears in
- A one-line description of its role in the edit

This section helps the user (and the generator) see the full palette of techniques at a glance. Group similar effects together. Typical categories include: speed manipulation, camera movement, digital effects, transitions, compositing, optical effects.

### Section 3: EFFECTS DENSITY MAP

Break the timeline into segments (roughly 3-6 second chunks) and rate each as:
- **HIGH DENSITY** — 4+ effects stacked or rapid-fire
- **MEDIUM DENSITY** — 2-3 effects
- **LOW DENSITY** — 1 effect or clean/simple footage

Format:
```
[timestamp range] = [DENSITY LEVEL] ([brief list of effects] — [count] effects in [duration])
```

### Section 4: MOTION FLOW

Describe the overall movement and pacing structure of the video — how it opens, builds, and resolves. This applies whether the clip is one continuous shot or many cuts.

- **Opening**: How the clip enters — what's the first thing the viewer feels?
- **Build**: How momentum develops — where does it accelerate, slow, or shift?
- **Resolution**: How the energy lands — what's the final impression?

Adapt to the clip's actual structure. A single 8-second shot might have one smooth arc. A 30-second sequence might have four or five distinct phases. Follow what the brief actually calls for.

## Creative principles

These principles should guide every prompt you write:

1. **Contrast drives impact.** Alternate high-density and low-density moments. A slow-motion shot after a speed ramp hits harder than two speed ramps back-to-back.
2. **Signature moments matter.** Every video should have at least one "hero" effect — something visually distinctive that makes it memorable. Call it out explicitly.
3. **Transitions are shots.** Don't treat transitions as throwaway connectors. A whip pan, a bloom flash, a motion blur smear — these are creative moments, not just cuts.
4. **Specificity over vagueness.** "The frame rotates clockwise by approximately 15-20°" is better than "the camera tilts." "Approximately 20-25% speed" is better than "slow motion."
5. **Energy must resolve.** No matter how intense the opening, the video needs to land. The final moments should feel intentional, not like the effects budget ran out.

## Tone and style

- Write in a direct, technical tone — like a director's shot notes, not a marketing brief
- Use bullet points within each shot block for clarity
- Be concise but complete — every detail should earn its place
- No hype language, no "stunning" or "breathtaking" — describe what happens and let the visuals speak

## Duration calibration

**Maximum clip duration is 30 seconds. Never exceed this.** If the user requests longer, cap at 30 seconds and note that.

Do not pre-assign a number of shots based on duration. Duration informs effects density and pacing — not structure. A 30-second clip could be one continuous shot or twenty cuts depending on the brief.

- **5-8 seconds**: Lean and punchy — keep effects tight, 1 signature effect
- **8-15 seconds**: Room for contrast and build, 1-2 signature effects
- **15-22 seconds**: Full arc with clear opening, peak, and resolution, 2 signature effects
- **22-30 seconds**: Extended arc with multiple movements — needs at least one deliberate reset or breathing moment to avoid fatigue, 2-3 signature effects spaced apart

At longer durations, density discipline matters more than effect count. A 30-second clip that runs high-density throughout reads as noise — protect the low-density stretches.

If the user doesn't specify a duration, default to 20-25 seconds.

## Example workflow

**User says:** "I want a dramatic brand film for a trail running shoe. Mountain setting, golden hour, single runner. Make it feel epic but not over-the-top. About 30 seconds."

**You do:**
1. Read `references/effects-breakdown-reference.txt` to calibrate detail level
2. Determine structure from the brief — "single runner, mountain" could be one continuous tracking shot or a few cuts; decide based on what serves the brief
3. Generate the full four-section output: effects timeline, master effects inventory, density map, and motion flow
4. Present in plain text in chat
