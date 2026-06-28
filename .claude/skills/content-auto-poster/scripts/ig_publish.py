#!/usr/bin/env python3
"""ig_publish.py — publish ONE Instagram Reel via the Instagram Graph API.

usage:
    IG_USER_ID=...  IG_ACCESS_TOKEN=...  python3 ig_publish.py \
        --video-url "https://yourcdn.com/reel.mp4" \
        --caption "Your caption … Comment CLOSER 👇" \
        --first-comment "Comment CLOSER and I'll send it 👇" \
        [--share-to-feed] [--dry-run]

Requirements (one-time setup — see the manual):
  • Instagram **Business or Creator** account linked to a Facebook Page
  • A Meta (Facebook) app with the Instagram Graph API
  • A long-lived access token with `instagram_content_publish` (+ pages perms)
  • IG_USER_ID  = your Instagram Business account ID
  • The video must be hosted at a PUBLIC https URL (IG pulls it from there)

This is stdlib-only (urllib). It does NOT store your token — it reads it from the
environment at run time. TikTok is not supported here (its Content Posting API needs
separate app review); schedule TikTok via a scheduler CSV instead.
"""
import os, sys, json, time, argparse, urllib.parse, urllib.request

API = "https://graph.facebook.com/v21.0"


def _call(method, path, params):
    url = f"{API}/{path}"
    data = urllib.parse.urlencode(params).encode()
    if method == "GET":
        url = url + "?" + data.decode()
        req = urllib.request.Request(url, method="GET")
    else:
        req = urllib.request.Request(url, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"[error] {method} {path} -> HTTP {e.code}: {body}", file=sys.stderr)
        sys.exit(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video-url", required=True)
    ap.add_argument("--caption", default="")
    ap.add_argument("--first-comment", default="")
    ap.add_argument("--share-to-feed", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    uid = os.environ.get("IG_USER_ID")
    token = os.environ.get("IG_ACCESS_TOKEN")
    if not uid or not token:
        print("[error] set IG_USER_ID and IG_ACCESS_TOKEN env vars (see the manual)", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        print(f"[dry-run] would publish REEL\n  video: {args.video_url}\n  caption: {args.caption[:80]}…", file=sys.stderr)
        return

    # 1) create media container
    print("[ig] creating reel container…", file=sys.stderr)
    c = _call("POST", f"{uid}/media", {
        "media_type": "REELS",
        "video_url": args.video_url,
        "caption": args.caption,
        "share_to_feed": "true" if args.share_to_feed else "false",
        "access_token": token,
    })
    cid = c.get("id")
    if not cid:
        print(f"[error] no container id: {c}", file=sys.stderr); sys.exit(1)

    # 2) poll until the upload finishes processing
    for i in range(30):
        st = _call("GET", cid, {"fields": "status_code", "access_token": token})
        code = st.get("status_code")
        print(f"[ig] status: {code}", file=sys.stderr)
        if code == "FINISHED":
            break
        if code == "ERROR":
            print(f"[error] processing failed: {st}", file=sys.stderr); sys.exit(1)
        time.sleep(6)
    else:
        print("[error] timed out waiting for processing", file=sys.stderr); sys.exit(1)

    # 3) publish
    print("[ig] publishing…", file=sys.stderr)
    pub = _call("POST", f"{uid}/media_publish", {"creation_id": cid, "access_token": token})
    media_id = pub.get("id")
    if not media_id:
        print(f"[error] publish failed: {pub}", file=sys.stderr); sys.exit(1)

    # 4) optional first comment (the keyword CTA)
    if args.first_comment:
        _call("POST", f"{media_id}/comments", {"message": args.first_comment, "access_token": token})
        print("[ig] first comment posted", file=sys.stderr)

    print(media_id)
    print(f"[ig] ✅ published reel {media_id}", file=sys.stderr)


if __name__ == "__main__":
    main()
