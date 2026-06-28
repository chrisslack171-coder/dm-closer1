# Auto Poster (Claude Code skill)

Hand Claude a video, and it posts or schedules it straight to your socials through Zernio — Instagram, TikTok, YouTube, LinkedIn, Threads. If you don't write a caption, it transcribes the video locally and writes one for you.

This is a **Claude Code skill**. You run it by talking to Claude, not by running it yourself.

---

## 1. Install (drag & drop)

1. Unzip this folder.
2. Drop the whole `auto-poster` folder into your Claude skills directory:
   - **This project only:** `<your-project>/.claude/skills/`
   - **Every project:** `~/.claude/skills/`  *(the `.claude` folder in your home directory)*

That's it — Claude auto-discovers it. If `.claude/skills/` doesn't exist yet, create it, or just ask Claude: *"make a skills folder and put auto-poster in it."*

## 2. Add your keys

1. In the `auto-poster` folder, copy `.env.example` to `.env`.
2. Open `.env` and paste in your Zernio API key (Zernio → Settings → API).
3. For the account IDs, just tell Claude: **"fetch my Zernio account IDs"** — it pulls them from your account and fills in the file. (Or grab them yourself from `GET https://zernio.com/api/v1/accounts`.)

Your `.env` stays on your machine. Never share it — it's your live credentials.

## 3. Use it

Just talk to Claude in that project:

- *"post this video /path/to/reel.mp4"*
- *"schedule this video for Friday at noon — /path/to/reel.mp4"*
- *"post this to instagram and tiktok with this caption: ..."*
- *"queue this reel"*

Claude shows you the caption and confirms before anything goes live.

---

## Requirements

- **Claude Code** installed.
- A **Zernio** account with your socials connected, and an API key.
- Command-line tools (most Macs already have these): `python3`, `ffmpeg`, `curl`, `git`, `make`, `gcc`.
  - Only the **auto-caption** feature needs these. The first time it transcribes a video it builds a tiny local speech-to-text engine (~3–5 min, one time). Every run after is a couple seconds. If you always supply your own captions, you don't need it.

## Notes

- Nothing is posted without your confirmation on the first post of a session.
- It only talks to Zernio — no other accounts, no other services.
- Full behavior and options are documented in `SKILL.md` (that's the file Claude reads).
