#!/usr/bin/env python3
import argparse
import json
import mimetypes
import os
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


ZERNIO_URL = "https://zernio.com/api/v1"


def load_env(path):
    env_path = Path(path)
    if not env_path.exists():
        return
    for raw in env_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def is_url(value):
    parsed = urlparse(value)
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def run(cmd, timeout=120):
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "command failed").strip())
    return result.stdout.strip()


def curl_json(method, url, api_key=None, payload=None, headers=None, timeout=120):
    cmd = ["curl", "-sS", "-X", method, url]
    if api_key:
        cmd.extend(["-H", f"Authorization: Bearer {api_key}"])
    for header in headers or []:
        cmd.extend(["-H", header])
    if payload is not None:
        cmd.extend(["-H", "Content-Type: application/json", "-d", json.dumps(payload)])

    stdout = run(cmd, timeout=timeout)
    try:
        return json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Zernio returned non-JSON response: {stdout[:500]}") from exc


def guess_content_type(path):
    guessed, _ = mimetypes.guess_type(str(path))
    suffix = path.suffix.lower()
    overrides = {
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".m4v": "video/x-m4v",
        ".avi": "video/x-msvideo",
        ".webm": "video/webm",
    }
    return overrides.get(suffix, guessed or "video/mp4")


def verify_url(url, required=True, attempts=5, delay=3):
    # Check the actual HTTP status code, NOT a substring of the header dump:
    # a Content-Length like 102040443 contains "404" and would false-positive.
    # Retry a few times because freshly-uploaded objects can 404 briefly while
    # they propagate.
    last = None
    for attempt in range(attempts):
        try:
            last = run(
                ["curl", "-sI", "-o", "/dev/null", "-w", "%{http_code}", url],
                timeout=20,
            ).strip()
        except Exception as exc:
            last = f"err:{exc}"
        else:
            if last not in ("403", "404", "000"):
                return
        if attempt < attempts - 1:
            time.sleep(delay)

    msg = f"Media URL not reachable (last status {last}): {url}"
    if required:
        raise RuntimeError(msg)
    # Media we uploaded ourselves: the PUT already succeeded, and Zernio reads it
    # server-side, so a client-side HEAD failure shouldn't block the post.
    print(f"warning: {msg} — proceeding (media was uploaded by us)", file=sys.stderr)


def zernio_base_url():
    return os.environ.get("ZERNIO_API_URL", ZERNIO_URL).rstrip("/")


def upload_to_zernio(api_key, video_path):
    path = Path(video_path).expanduser()
    if not path.exists():
        raise FileNotFoundError(f"Video not found: {path}")
    if not path.is_file():
        raise ValueError(f"Video path is not a file: {path}")

    content_type = guess_content_type(path)
    presign = curl_json(
        "POST",
        f"{zernio_base_url()}/media/presign",
        api_key=api_key,
        payload={
            "filename": path.name,
            "contentType": content_type,
            "size": path.stat().st_size,
        },
        timeout=90,
    )
    if presign.get("error"):
        raise RuntimeError(f"Zernio presign failed: {presign}")

    upload_url = presign.get("uploadUrl")
    public_url = presign.get("publicUrl")
    if not upload_url or not public_url:
        raise RuntimeError(f"Zernio presign response missing uploadUrl/publicUrl: {presign}")

    run(
        [
            "curl",
            "-sS",
            "-X",
            "PUT",
            upload_url,
            "-H",
            f"Content-Type: {content_type}",
            "--data-binary",
            f"@{path}",
        ],
        timeout=900,
    )
    return public_url


def caption_from_args(args):
    if args.caption_file:
        return Path(args.caption_file).expanduser().read_text().strip()
    return (args.caption or "").strip()


def yt_title_from_args(args, source, caption):
    if args.yt_title:
        return args.yt_title.strip()
    if caption:
        return caption.splitlines()[0][:95].strip()
    if is_url(source):
        name = Path(urlparse(source).path).stem
        return name or "Video"
    return Path(source).stem or "Video"


def require_env(name):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def optional_env(*names):
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return None


def parse_platforms(value):
    platforms = [p.strip().lower() for p in value.split(",") if p.strip()]
    aliases = {"x": "twitter", "twitter/x": "twitter"}
    platforms = [aliases.get(platform, platform) for platform in platforms]
    allowed = {
        "instagram",
        "tiktok",
        "youtube",
        "twitter",
        "linkedin",
        "facebook",
        "threads",
        "pinterest",
        "reddit",
        "bluesky",
    }
    invalid = sorted(set(platforms) - allowed)
    if invalid:
        raise ValueError(f"Unsupported platform(s): {', '.join(invalid)}")
    return platforms


def account_id_for(platform):
    normalized = platform.upper().replace("-", "_")
    return optional_env(
        f"ZERNIO_ACCOUNT_{normalized}",
        f"ZERNIO_ACCOUNT_ID_{normalized}",
    )


def platform_targets(platforms, require_accounts):
    targets = []
    missing = []
    for platform in platforms:
        account_id = account_id_for(platform)
        target = {"platform": platform}
        if account_id:
            target["accountId"] = account_id
        elif require_accounts:
            missing.append(f"ZERNIO_ACCOUNT_{platform.upper()}")
        targets.append(target)
    if missing:
        raise RuntimeError("Missing required env var(s): " + ", ".join(missing))
    return targets


def media_item(media_url):
    path = Path(urlparse(media_url).path)
    guessed = guess_content_type(path)
    media_type = "image" if guessed.startswith("image/") else "video"
    return {"type": media_type, "url": media_url}


def build_payload(args, platforms, media_url, caption, title):
    require_accounts = not args.allow_default_accounts
    payload = {
        "content": caption,
        "mediaItems": [media_item(media_url)],
        "platforms": platform_targets(platforms, require_accounts),
        "timezone": args.timezone,
    }

    if "youtube" in platforms and title:
        payload["title"] = title[:100]

    if args.mode == "shareNow":
        payload["publishNow"] = True
    elif args.mode == "customScheduled":
        payload["scheduledFor"] = args.due_at
    elif args.mode == "addToQueue":
        payload["queuedFromProfile"] = require_env("ZERNIO_PROFILE_ID")
        queue_id = optional_env("ZERNIO_QUEUE_ID")
        if queue_id:
            payload["queueId"] = queue_id
    elif args.mode == "draft":
        payload["isDraft"] = True

    return payload


def create_post(api_key, payload, request_id, timeout=240):
    return curl_json(
        "POST",
        f"{zernio_base_url()}/posts",
        api_key=api_key,
        payload=payload,
        headers=[f"x-request-id: {request_id}"],
        timeout=timeout,
    )


def extract_posts(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("posts", "data", "results", "items"):
            value = data.get(key)
            if isinstance(value, list):
                return value
            if isinstance(value, dict):
                nested = extract_posts(value)
                if nested:
                    return nested
    return []


def extract_post(response):
    if not isinstance(response, dict):
        return {}
    return response.get("post") or response.get("data", {}).get("post") or {}


def list_recent_posts(api_key, limit=10):
    data = curl_json(
        "GET", f"{zernio_base_url()}/posts?limit={limit}", api_key=api_key, timeout=60
    )
    return extract_posts(data)


def _is_recent(post, minutes=15):
    ts = post.get("createdAt") or post.get("updatedAt")
    if not ts:
        return True
    try:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return True
    return (datetime.now(timezone.utc) - dt).total_seconds() <= minutes * 60


def find_recent_post(api_key, caption, media_basename=None):
    # Used to recover after a timed-out create: a create request can succeed
    # server-side even when the client's HTTP call times out. Match on the
    # exact caption (recent only) so we never confuse it with an older post.
    try:
        posts = list_recent_posts(api_key, limit=10)
    except Exception:
        return None
    target = (caption or "").strip()
    for post in posts:
        if not _is_recent(post):
            continue
        if (post.get("content") or "").strip() == target:
            return post
    if media_basename:
        for post in posts:
            if not _is_recent(post):
                continue
            for item in post.get("mediaItems", []):
                if str(item.get("url", "")).rsplit("/", 1)[-1] == media_basename:
                    return post
    return None


def reconcile(api_key, caption, media_basename=None, attempts=4, delay=4):
    for attempt in range(attempts):
        found = find_recent_post(api_key, caption, media_basename)
        if found:
            return found
        if attempt < attempts - 1:
            time.sleep(delay)
    return None


def create_post_resilient(api_key, payload, caption, media_basename, max_retries=1):
    # One stable request id for the whole logical post: if Zernio honors
    # x-request-id for idempotency, retries dedupe; if it doesn't, the
    # reconcile() guard below still prevents duplicates.
    request_id = str(uuid.uuid4())
    caption = (caption or "").strip()
    last_error = None

    for attempt in range(max_retries + 1):
        try:
            response = create_post(api_key, payload, request_id)
        except Exception as exc:
            # Network error or timeout: the post MAY have landed. Never blind-retry.
            last_error = exc
            recovered = reconcile(api_key, caption, media_basename)
            if recovered:
                return recovered, "recovered-after-timeout"
            continue  # genuinely didn't land -> safe retry with same request_id

        if isinstance(response, dict) and response.get("error"):
            recovered = reconcile(api_key, caption, media_basename, attempts=2, delay=3)
            if recovered:
                return recovered, "recovered-after-error"
            raise RuntimeError(f"Zernio create failed: {json.dumps(response)[:500]}")

        post = extract_post(response)
        if post:
            return post, "created"

        recovered = reconcile(api_key, caption, media_basename, attempts=2, delay=3)
        if recovered:
            return recovered, "recovered"
        raise RuntimeError(f"Zernio returned no post and no error: {json.dumps(response)[:500]}")

    recovered = reconcile(api_key, caption, media_basename)
    if recovered:
        return recovered, "recovered-after-retries"
    raise RuntimeError(f"create_post failed and no matching post was found: {last_error}")


TERMINAL_STATUSES = {"published", "posted", "failed", "error", "rejected"}


def wait_for_terminal(api_key, post, max_seconds, delay=5):
    post_id = post.get("_id") or post.get("id")
    if not post_id or max_seconds <= 0:
        return post
    latest, waited = post, 0
    while waited < max_seconds:
        platforms = latest.get("platforms", [])
        if platforms and all(
            (pf.get("status") or "").lower() in TERMINAL_STATUSES for pf in platforms
        ):
            return latest
        time.sleep(delay)
        waited += delay
        for candidate in list_recent_posts(api_key, limit=20):
            if (candidate.get("_id") or candidate.get("id")) == post_id:
                latest = candidate
                break
    return latest


def summarize_post(post):
    if not post:
        return {}
    return {
        "post_id": post.get("_id") or post.get("id"),
        "status": post.get("status"),
        "scheduled_for": post.get("scheduledFor"),
        "platforms": [
            {
                "platform": platform.get("platform"),
                "status": platform.get("status"),
                "platform_post_url": platform.get("platformPostUrl"),
                "error": platform.get("error"),
            }
            for platform in post.get("platforms", [])
        ],
    }


def main():
    parser = argparse.ArgumentParser(description="Post a provided video directly to Zernio.")
    parser.add_argument("video", help="Local video path or public video URL")
    parser.add_argument("--caption", default="", help="Caption text")
    parser.add_argument("--caption-file", help="Path to a caption text file")
    parser.add_argument("--platforms", default="instagram,tiktok,youtube")
    parser.add_argument(
        "--mode",
        default="shareNow",
        choices=["shareNow", "addToQueue", "customScheduled", "draft"],
    )
    parser.add_argument("--due-at", help="ISO time for customScheduled mode")
    parser.add_argument("--timezone", default=os.environ.get("ZERNIO_TIMEZONE", "America/Chicago"))
    parser.add_argument("--yt-title", help="YouTube title")
    parser.add_argument("--allow-default-accounts", action="store_true", help="Send platform names without explicit account IDs")
    parser.add_argument("--dry-run", action="store_true", help="Print the Zernio payload without posting")
    parser.add_argument("--skip-verify", action="store_true", help="Skip the media URL reachability check")
    parser.add_argument("--wait-seconds", type=int, default=0, help="Poll the created post until every platform reaches a terminal state, up to N seconds")
    parser.add_argument("--max-retries", type=int, default=1, help="Safe create retries; each is guarded by reconciliation so timeouts never duplicate")
    parser.add_argument("--env-file", default=".env")
    args = parser.parse_args()

    load_env(args.env_file)

    if args.mode == "customScheduled" and not args.due_at:
        raise RuntimeError("--due-at is required when --mode customScheduled")

    api_key = require_env("ZERNIO_API_KEY")
    platforms = parse_platforms(args.platforms)
    caption = caption_from_args(args)
    title = yt_title_from_args(args, args.video, caption)

    media_url = args.video if is_url(args.video) else upload_to_zernio(api_key, args.video)
    media_basename = Path(urlparse(media_url).path).name

    if not args.skip_verify:
        # Hard-fail only for URLs the user gave us; for media we just uploaded,
        # a client-side reachability failure is a warning, not a blocker.
        verify_url(media_url, required=is_url(args.video))

    payload = build_payload(args, platforms, media_url, caption, title)
    if args.dry_run:
        print(json.dumps({"media_url": media_url, "payload": payload}, indent=2))
        return

    post, source = create_post_resilient(
        api_key, payload, caption, media_basename, max_retries=args.max_retries
    )
    post = wait_for_terminal(api_key, post, args.wait_seconds)

    print(
        json.dumps(
            {
                "media_url": media_url,
                "mode": args.mode,
                "platforms": platforms,
                "source": source,
                "result": summarize_post(post),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
