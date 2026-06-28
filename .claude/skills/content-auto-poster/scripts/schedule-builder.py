#!/usr/bin/env python3
"""schedule-builder.py — turn a list of posts into a dated posting schedule + a
scheduler-ready CSV you can bulk-import into Metricool / Publer / Later / Buffer.

usage:
    python3 schedule-builder.py posts.json --start 2026-07-01 --times 09:00,17:00 \
        --days Mon,Tue,Wed,Thu,Fri --out schedule.csv

posts.json  — a list of posts, each: {"caption": "...", "media": "<public video URL
              or local file path>", "hashtags": "#a #b", "keyword": "CLOSER"}
              (keyword is optional; if present it's appended as the first comment.)

Stdlib only. No network, no posting — this just plans + writes the CSV. The actual
publishing is done by your scheduler (import the CSV) or by ig_publish.py.
"""
import sys, json, csv, argparse
from datetime import datetime, timedelta

DAYMAP = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


def load_posts(path):
    with open(path) as f:
        data = json.load(f)
    return data if isinstance(data, list) else data.get("posts", [])


def first_comment(post):
    kw = (post.get("keyword") or "").strip()
    tags = (post.get("hashtags") or "").strip()
    bits = []
    if kw:
        bits.append(f"Comment {kw} and I'll send it to you 👇")
    if tags:
        bits.append(tags)
    return "\n".join(bits)


def slot_dates(start, times, days, n):
    """Yield (date, time) slots: `len(times)` posts per allowed weekday, in order."""
    allowed = {DAYMAP[d.strip().lower()[:3]] for d in days if d.strip()}
    out, cur = [], start
    while len(out) < n:
        if not allowed or cur.weekday() in allowed:
            for t in times:
                out.append((cur, t))
                if len(out) >= n:
                    break
        cur += timedelta(days=1)
    return out[:n]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("posts")
    ap.add_argument("--start", required=True, help="YYYY-MM-DD")
    ap.add_argument("--times", default="09:00,17:00", help="comma list, e.g. 09:00,17:00")
    ap.add_argument("--days", default="Mon,Tue,Wed,Thu,Fri,Sat,Sun")
    ap.add_argument("--out", default="schedule.csv")
    args = ap.parse_args()

    posts = load_posts(args.posts)
    if not posts:
        print("[error] no posts in input", file=sys.stderr); sys.exit(1)

    start = datetime.strptime(args.start, "%Y-%m-%d")
    times = [t.strip() for t in args.times.split(",") if t.strip()]
    days = args.days.split(",")
    slots = slot_dates(start, times, days, len(posts))

    rows = []
    for post, (d, t) in zip(posts, slots):
        rows.append({
            "date": d.strftime("%Y-%m-%d"),
            "time": t,
            "caption": (post.get("caption") or "").strip(),
            "first_comment": first_comment(post),
            "media": (post.get("media") or "").strip(),
            "hashtags": (post.get("hashtags") or "").strip(),
        })

    with open(args.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["date", "time", "caption", "first_comment", "media", "hashtags"])
        w.writeheader()
        w.writerows(rows)

    # printed plan
    print(f"[schedule] {len(rows)} posts, {args.times} on {args.days}, starting {args.start}", file=sys.stderr)
    for r in rows:
        cap = " ".join(r["caption"].split())[:54]
        print(f"  {r['date']} {r['time']}  {cap}", file=sys.stderr)
    print(args.out)


if __name__ == "__main__":
    main()
