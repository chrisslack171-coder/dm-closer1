#!/usr/bin/env python3
"""rank-and-select.py — rank scraped IG reels/posts, then prep job dirs + media.

usage:
    python3 rank-and-select.py <dataset.json> <date_root> [--per-handle 3] [--expect h1,h2,h3] [--expect-count N]

<dataset.json>  the combined tokscript scrape the orchestrator saved to disk:
                each handle's `get_instagram_user_reels` items pooled into ONE
                array (a bare list, or {"items":[...]}). No MCP call happens
                here — this is pure local processing, stdlib only (no uv, no
                pillow). Field names are read defensively (see `field()`), so
                tokscript's exact shape doesn't have to match a fixed schema.
<date_root>     /tmp/ig-research/<RUN>/

Ranks every post by LIKES (hidden -1 sorts last, ties broken by comments),
keeps the top N per handle, pools, sorts the whole set high-to-low, and writes:

  <date_root>/selection.json                  the ordered picks (meta only)
  <date_root>/<rank>_<handle>/videourl.txt    reels/videos  (the direct video URL)
  <date_root>/<rank>_<handle>/imageurls.txt   carousels/images (one URL per line)

Prints a ranked table to stderr and flags any pick whose media URL is missing,
plus any --expect handle that returned nothing in the window. The orchestrator
reads selection.json to fan out the subagents — it never has to sort, format a
date, or touch a giant media blob itself.

tokscript gives view counts (Apify did not), so `views` is carried through to
selection.json and shown in the table. Ranking is still by LIKES for cross-
format consistency; breakout is still likes ÷ that handle's weekly median.
"""
import sys, os, json, argparse, re, statistics
from datetime import datetime, timezone


# Containers tokscript (or any scraper) might nest the stats under.
_NESTED = ("stats", "statistics", "engagement", "metrics", "counts", "videoMeta", "video")


def field(item, *keys, default=None):
    """First non-empty value among `keys`, checked top-level then in nested
    stat containers. Lets the ranker tolerate tokscript's field names without a
    rigid schema."""
    for k in keys:
        v = item.get(k)
        if v not in (None, ""):
            return v
    for nk in _NESTED:
        sub = item.get(nk)
        if isinstance(sub, dict):
            for k in keys:
                v = sub.get(k)
                if v not in (None, ""):
                    return v
    return default


def to_int(v, default=0):
    """Parse ints, numeric strings, and human-formatted counts ('1.2K', '3.4M')."""
    if isinstance(v, bool):
        return default
    if isinstance(v, (int, float)):
        return int(v)
    if isinstance(v, str):
        s = v.strip().replace(",", "")
        m = re.match(r"^(-?\d+(?:\.\d+)?)\s*([KkMmBb]?)$", s)
        if m:
            num = float(m.group(1))
            mult = {"": 1, "k": 1e3, "m": 1e6, "b": 1e9}[m.group(2).lower()]
            return int(num * mult)
    return default


def load_items(path):
    with open(path) as f:
        data = json.load(f)
    if isinstance(data, dict):
        for k in ("items", "results", "reels", "data", "videos", "posts"):
            if isinstance(data.get(k), list):
                return data[k]
        return []
    return data


def get_handle(item):
    """tokscript may give the handle as a plain string or an author object."""
    h = field(item, "ownerUsername", "username", "handle", "authorName", "ownerUserName")
    if not h:
        author = item.get("author") or item.get("owner") or item.get("user")
        if isinstance(author, dict):
            h = (author.get("username") or author.get("uniqueId")
                 or author.get("handle") or author.get("name"))
        elif isinstance(author, str):
            h = author
    return (h or "unknown").lstrip("@")


def get_likes(item):
    return to_int(field(item, "likesCount", "likes", "likeCount", "diggCount",
                         "like_count", default=-1), default=-1)


def get_comments(item):
    return to_int(field(item, "commentsCount", "comments", "commentCount",
                        "comment_count", default=0), default=0)


def get_views(item):
    return to_int(field(item, "videoViewCount", "views", "viewCount", "playCount",
                        "play_count", "video_view_count", "viewsCount", "playsCount",
                        default=-1), default=-1)


def get_video_url(item):
    """Direct, downloadable video URL. tokscript's reel listing and
    download_videos_bulk expose this under varying keys; the orchestrator may
    also merge a resolved download link onto the item under `videoUrl`."""
    return field(item, "videoUrl", "downloadUrl", "video_url", "download_url",
                 "playUrl", "play_url", "mediaUrl", "media_url", "hdUrl", "video",
                 "downloadLink", "url_download", default="") or ""


def get_image_urls(item):
    for k in ("images", "imageUrls", "image_urls", "slides", "mediaUrls"):
        v = item.get(k)
        if isinstance(v, list) and v:
            return [u for u in v if isinstance(u, str) and u]
    disp = field(item, "displayUrl", "display_url", "thumbnail", "thumbnailUrl",
                 "coverUrl", "cover")
    return [disp] if disp else []


def get_permalink(item):
    return field(item, "url", "postUrl", "post_url", "link", "webVideoUrl",
                 "shareUrl", "permalink", default="") or ""


def get_shortcode(item):
    return field(item, "shortCode", "shortcode", "code", "id", "videoId",
                 default="") or ""


def get_caption(item):
    return (field(item, "caption", "title", "description", "text", "desc",
                  default="") or "").strip()


def get_timestamp(item):
    return field(item, "timestamp", "createTimeISO", "createTime", "takenAt",
                 "takenAtTimestamp", "date", "created_at", "taken_at",
                 "publishedAt", default="")


def fmt_count(n):
    """Comma-formatted integer; hidden/unknown (-1) -> 'hidden'."""
    try:
        n = int(n)
    except (TypeError, ValueError):
        return "hidden"
    return "hidden" if n < 0 else f"{n:,}"


def fmt_date(ts):
    if ts in (None, ""):
        return ""
    # epoch seconds / ms (tokscript often returns these)
    if isinstance(ts, (int, float)) or (isinstance(ts, str) and ts.isdigit()):
        n = int(ts)
        if n > 1e12:        # milliseconds
            n //= 1000
        try:
            dt = datetime.fromtimestamp(n, tz=timezone.utc)
            return f"{dt.strftime('%b')} {dt.day}, {dt.year}"
        except (ValueError, OSError, OverflowError):
            return ""
    ts = str(ts)
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        try:
            dt = datetime.strptime(ts[:19], "%Y-%m-%dT%H:%M:%S")
        except Exception:
            return ts[:10]
    return f"{dt.strftime('%b')} {dt.day}, {dt.year}"


def post_format(item):
    """tokscript get_instagram_user_reels returns reels (videos). get_*_posts may
    mix carousels/images — detect those defensively."""
    t = (field(item, "type", "mediaType", "media_type", "productType",
               "product_type", default="") or "").lower()
    if t in ("sidecar", "carousel", "carousel_album", "album"):
        return "Carousel"
    if t in ("image", "photo", "graphimage"):
        return "Image"
    if t in ("clips", "reel", "reels"):
        return "Reel"
    if t in ("video", "graphvideo"):
        return "Video"
    # multiple image URLs with no direct video -> carousel
    if len(get_image_urls(item)) > 1 and not get_video_url(item):
        return "Carousel"
    return "Reel"  # default branch: tokscript reels are videos


def rank_key(item):
    """Sort ascending puts the best first: non-hidden, then likes desc, comments desc."""
    likes = get_likes(item)
    comments = get_comments(item)
    return (likes < 0, -(max(likes, 0)), -comments)


def safe_handle(h):
    return re.sub(r"[^A-Za-z0-9._-]", "_", h or "unknown")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dataset")
    ap.add_argument("date_root")
    ap.add_argument("--per-handle", type=int, default=3)
    ap.add_argument("--expect", default="")
    ap.add_argument("--expect-count", type=int, default=0,
                    help="hard-fail unless the dataset holds exactly this many items "
                         "(guards the scrape-to-disk write against a dropped record)")
    args = ap.parse_args()

    items = load_items(args.dataset)
    if not items:
        print("[error] dataset has no items", file=sys.stderr)
        sys.exit(1)
    if args.expect_count and len(items) != args.expect_count:
        print(f"[error] dataset.json holds {len(items)} items but --expect-count={args.expect_count}. "
              f"A record was dropped or garbled writing the scrape result to disk — "
              f"re-pull via tokscript and rewrite dataset.json verbatim before re-running.",
              file=sys.stderr)
        sys.exit(1)

    # restrict to the requested roster: a profile scrape occasionally returns a
    # stray handle (a tagged or collab reel), and --expect is authoritative here
    # — not just a missing-flag. Empty --expect (no roster passed) keeps all.
    expected = [h.strip().lstrip("@") for h in args.expect.split(",") if h.strip()]
    if expected:
        elc = [h.lower() for h in expected]
        items = [it for it in items if get_handle(it).lower() in elc]
        if not items:
            print(f"[error] no posts match --expect handles ({', '.join(expected)}) — "
                  f"check the handles or the scrape", file=sys.stderr)
            sys.exit(1)

    # group by handle
    by_handle = {}
    for it in items:
        by_handle.setdefault(get_handle(it), []).append(it)

    # per-handle baseline = median likes across that handle's non-hidden posts in
    # the window. A pick's breakout score = its likes / this baseline, so a small
    # account's overperformer isn't buried under a big account's median-level post.
    baseline = {}
    for h, posts in by_handle.items():
        vals = [v for v in (get_likes(p) for p in posts) if v >= 0]
        baseline[h] = statistics.median(vals) if vals else 0

    # top N per handle, then pool + global sort
    picks = []
    for h, posts in by_handle.items():
        posts.sort(key=rank_key)
        picks.extend(posts[: args.per_handle])
    picks.sort(key=rank_key)

    os.makedirs(args.date_root, exist_ok=True)
    selection, warnings, rows = [], [], []

    for i, it in enumerate(picks, start=1):
        handle = get_handle(it)
        fmt = post_format(it)
        jobdir = os.path.join(args.date_root, f"{i}_{safe_handle(handle)}")
        os.makedirs(jobdir, exist_ok=True)

        if fmt in ("Carousel", "Image"):
            urls = get_image_urls(it)
            with open(os.path.join(jobdir, "imageurls.txt"), "w") as f:
                f.write("\n".join(urls) + ("\n" if urls else ""))
            if not urls:
                warnings.append(f"#{i} @{handle} {fmt}: no image URLs in dataset")
            elif any(not u.startswith("http") for u in urls):
                warnings.append(f"#{i} @{handle} {fmt}: an image URL looks malformed — re-check the dataset write")
        else:  # Reel / Video
            vurl = get_video_url(it)      # direct mp4 if the listing carried one
            purl = get_permalink(it)      # IG permalink — always present from tokscript
            with open(os.path.join(jobdir, "videourl.txt"), "w") as f:
                f.write(vurl + ("\n" if vurl else ""))
            with open(os.path.join(jobdir, "posturl.txt"), "w") as f:
                f.write(purl + ("\n" if purl else ""))
            # videourl.txt may be empty: the subagent resolves the direct link from
            # posturl.txt via tokscript download_video before running reel-breakdown.sh.
            if not vurl and not purl:
                warnings.append(f"#{i} @{handle} {fmt}: no video URL AND no permalink — this reel can't be downloaded")
            elif vurl and not vurl.startswith("http"):
                warnings.append(f"#{i} @{handle} {fmt}: video URL looks malformed — re-check the dataset write")

        lk = get_likes(it)
        vw = get_views(it)
        likes = fmt_count(lk)
        comments = fmt_count(get_comments(it))
        views = fmt_count(vw)
        date = fmt_date(get_timestamp(it))
        url = get_permalink(it)

        # breakout score: this post's likes vs its handle's weekly median
        base = baseline.get(handle, 0)
        if lk >= 0 and base and base > 0:
            score = round(lk / base, 1)
            olabel = f"{score:g}×"
        else:
            score, olabel = None, "—"

        selection.append({
            "rank": i,
            "handle": handle,
            "shortCode": get_shortcode(it),
            "format": fmt,
            "likes": likes,
            "comments": comments,
            "views": views,
            "date": date,
            "url": url,
            "outlier_score": score,
            "outlier_label": olabel,
            "baseline": int(base) if base else 0,
            "jobdir": jobdir,
            "caption": get_caption(it),
        })
        cap = " ".join(get_caption(it).split())[:40]
        vcol = views if vw >= 0 else "—"
        rows.append(f"  #{i:<2} @{handle:<18} {fmt:<9} {likes:>9} likes  {vcol:>10} views  "
                    f"{olabel:>6} brk  {comments:>7} cmts  {date:<13} {cap}")

    with open(os.path.join(args.date_root, "selection.json"), "w") as f:
        json.dump(selection, f, indent=2, ensure_ascii=False)

    # report
    print(f"[rank] {len(items)} posts scraped across {len(by_handle)} handle(s) "
          f"-> {len(selection)} picks (top {args.per_handle}/handle)", file=sys.stderr)
    for r in rows:
        print(r, file=sys.stderr)

    missing = [h for h in expected if h.lower() not in {k.lower() for k in by_handle}]
    for h in missing:
        warnings.append(f"@{h}: no posts in the window — contributes 0")
    for w in warnings:
        print(f"[warn] {w}", file=sys.stderr)

    print(os.path.join(args.date_root, "selection.json"))


if __name__ == "__main__":
    main()
