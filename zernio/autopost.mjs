#!/usr/bin/env node
// Zernio autoposter — watches a local folder and posts new videos to Zernio as drafts.
//
// Runs on YOUR machine (where the video files live). Zero dependencies — Node 18+ only.
// Reads config from environment variables (see .env.example). The API key never leaves
// your machine.
//
// Usage:
//   node zernio/autopost.mjs                 # watch the folder in ZERNIO_WATCH_DIR
//   node zernio/autopost.mjs --once <file>   # post a single file, then exit (handy for testing)

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Load .env (next to this script, then cwd) without any dependency.
// Real environment variables always win over the file.
// ---------------------------------------------------------------------------
function loadEnv() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const file of [path.join(here, ".env"), path.join(process.cwd(), ".env")]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      let val = m[2].replace(/^["']|["']$/g, ""); // strip optional surrounding quotes
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}
loadEnv();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_BASE = process.env.ZERNIO_API_BASE || "https://zernio.com/api/v1";
const API_KEY = process.env.ZERNIO_API_KEY;
const WATCH_DIR = process.env.ZERNIO_WATCH_DIR;
const PLATFORMS = (process.env.ZERNIO_PLATFORMS || "instagram,tiktok")
  .split(",")
  .map((p) => p.trim().toLowerCase())
  .filter(Boolean);
const DEFAULT_CAPTION = process.env.ZERNIO_CAPTION || "";
const TIKTOK_PRIVACY = process.env.ZERNIO_TIKTOK_PRIVACY || "PUBLIC_TO_EVERYONE";
const STABLE_MS = Number(process.env.ZERNIO_STABLE_MS || 3000); // file must stop growing for this long

const VIDEO_EXT = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".webm": "video/webm",
};

if (!API_KEY) die("ZERNIO_API_KEY is not set. Put it in a .env file or your environment.");

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function die(msg) {
  console.error("✖ " + msg);
  process.exit(1);
}
function log(...a) {
  console.log(`[${new Date().toISOString()}]`, ...a);
}
function auth() {
  return { Authorization: `Bearer ${API_KEY}` };
}
async function api(method, pathname, body) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: { ...auth(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathname} → HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Zernio flow: presign → upload bytes → create draft post
// ---------------------------------------------------------------------------
async function resolveAccounts() {
  const { accounts = [] } = await api("GET", "/accounts");
  const byPlatform = new Map();
  for (const a of accounts) byPlatform.set(a.platform, a);
  const resolved = [];
  for (const p of PLATFORMS) {
    const acc = byPlatform.get(p);
    if (!acc) {
      die(
        `Platform "${p}" is not connected to your Zernio account. ` +
          `Connected: ${[...byPlatform.keys()].join(", ") || "(none)"}. ` +
          `Fix ZERNIO_PLATFORMS or connect the account in Zernio.`
      );
    }
    resolved.push({ platform: p, accountId: acc._id, displayName: acc.displayName });
  }
  return resolved;
}

async function presign(filename, contentType) {
  return api("POST", "/media/presign", { filename, contentType });
}

async function uploadBytes(uploadUrl, filePath, contentType) {
  // Stream the file so large clips don't blow up memory.
  const stat = await fsp.stat(filePath);
  const stream = fs.createReadStream(filePath);
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType, "Content-Length": String(stat.size) },
    body: stream,
    duplex: "half", // required by Node fetch when body is a stream
  });
  if (!res.ok) {
    throw new Error(`Upload PUT failed → HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

function buildPostBody(content, publicUrl, accounts) {
  const body = {
    content,
    mediaItems: [{ url: publicUrl, type: "video" }],
    platforms: accounts.map((a) => ({ platform: a.platform, accountId: a.accountId })),
    // No scheduledFor / publishNow  ->  saved as a DRAFT in Zernio.
  };
  if (accounts.some((a) => a.platform === "tiktok")) {
    // Required so the TikTok draft is publish-ready from the Zernio dashboard.
    body.tiktokSettings = {
      privacy_level: TIKTOK_PRIVACY,
      allow_comment: true,
      allow_duet: true,
      allow_stitch: true,
      content_preview_confirmed: true,
      express_consent_given: true,
      draft: true,
    };
  }
  return body;
}

// Optional per-video caption: a sidecar "<name>.txt" next to the video overrides ZERNIO_CAPTION.
async function captionFor(filePath) {
  const sidecar = filePath.replace(/\.[^.]+$/, ".txt");
  try {
    const txt = await fsp.readFile(sidecar, "utf8");
    if (txt.trim()) return txt.trim();
  } catch {
    /* no sidecar — fall through */
  }
  return DEFAULT_CAPTION;
}

async function postVideo(filePath, accounts) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = VIDEO_EXT[ext];
  if (!contentType) {
    log(`skip (not a supported video): ${path.basename(filePath)}`);
    return;
  }
  const filename = path.basename(filePath);
  log(`posting draft: ${filename}`);

  const { uploadUrl, publicUrl } = await presign(filename, contentType);
  await uploadBytes(uploadUrl, filePath, contentType);
  const content = await captionFor(filePath);
  const result = await api("POST", "/posts", buildPostBody(content, publicUrl, accounts));
  const id = result?.post?._id || result?._id || "(unknown id)";
  log(`✔ draft created (${id}) for ${accounts.map((a) => a.platform).join(" + ")}: ${filename}`);
  return id;
}

// ---------------------------------------------------------------------------
// Ledger — remember what we've already posted (survives restarts, avoids dupes)
// ---------------------------------------------------------------------------
function ledgerPath(dir) {
  return path.join(dir, ".zernio-posted.json");
}
async function loadLedger(dir) {
  try {
    return new Set(JSON.parse(await fsp.readFile(ledgerPath(dir), "utf8")));
  } catch {
    return new Set();
  }
}
async function saveLedger(dir, set) {
  await fsp.writeFile(ledgerPath(dir), JSON.stringify([...set], null, 2));
}

// Wait until a file stops growing, so we don't upload a half-written recording.
async function waitUntilStable(filePath) {
  let last = -1;
  while (true) {
    let size;
    try {
      size = (await fsp.stat(filePath)).size;
    } catch {
      return false; // file vanished
    }
    if (size === last && size > 0) return true;
    last = size;
    await new Promise((r) => setTimeout(r, STABLE_MS));
  }
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------
async function runOnce(filePath) {
  const accounts = await resolveAccounts();
  log(`accounts: ${accounts.map((a) => `${a.platform}=${a.displayName}`).join(", ")}`);
  await postVideo(path.resolve(filePath), accounts);
}

async function runWatch() {
  if (!WATCH_DIR) die("ZERNIO_WATCH_DIR is not set. Point it at the folder to watch.");
  if (!fs.existsSync(WATCH_DIR)) die(`Watch folder does not exist: ${WATCH_DIR}`);

  const accounts = await resolveAccounts();
  log(`accounts: ${accounts.map((a) => `${a.platform}=${a.displayName}`).join(", ")}`);

  const ledger = await loadLedger(WATCH_DIR);
  // Treat everything already in the folder as "seen" so we only post NEW drops.
  for (const f of await fsp.readdir(WATCH_DIR)) {
    if (VIDEO_EXT[path.extname(f).toLowerCase()]) ledger.add(f);
  }
  await saveLedger(WATCH_DIR, ledger);

  const inFlight = new Set();
  log(`watching ${WATCH_DIR} for new videos → drafts on ${accounts.map((a) => a.platform).join(" + ")}`);
  log(`(existing files are ignored; drop a new clip in to post it)`);

  fs.watch(WATCH_DIR, async (_event, filename) => {
    if (!filename) return;
    const ext = path.extname(filename).toLowerCase();
    if (!VIDEO_EXT[ext]) return;
    if (ledger.has(filename) || inFlight.has(filename)) return;

    const full = path.join(WATCH_DIR, filename);
    if (!fs.existsSync(full)) return; // a delete/rename-away event
    inFlight.add(filename);
    try {
      log(`detected: ${filename} — waiting for it to finish writing…`);
      const ok = await waitUntilStable(full);
      if (!ok) {
        log(`gone before stable, skipping: ${filename}`);
        return;
      }
      if (ledger.has(filename)) return; // double-check after the wait
      await postVideo(full, accounts);
      ledger.add(filename);
      await saveLedger(WATCH_DIR, ledger);
    } catch (err) {
      console.error(`✖ failed on ${filename}:`, err.message);
    } finally {
      inFlight.delete(filename);
    }
  });
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const onceIdx = args.indexOf("--once");
try {
  if (onceIdx !== -1) {
    const file = args[onceIdx + 1];
    if (!file) die("--once needs a file path: node zernio/autopost.mjs --once <file>");
    await runOnce(file);
  } else {
    await runWatch();
  }
} catch (err) {
  die(err.message);
}
