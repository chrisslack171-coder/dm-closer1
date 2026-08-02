# The $5K Closer — Interactive Playbook

The $27 interactive version of The $5K Closer. Buyers work through the 6 steps of
the playbook and the AI engine does the heavy lifting at each one — ending with a
personalized, downloadable Launch Kit.

**The buyer's journey:**

| Step | What the buyer does | What the engine does |
|---|---|---|
| 01 The Shift | Answers 3 questions about what they know | Writes 3 versions of their one-sentence promise, picks the strongest |
| 02 Mine Your Knowledge | Answers the 4 mining questions | Proposes 3 ranked product ideas they can build in days |
| 03 Position It | One click | Runs the 3 demand checks, generates problem-naming titles + page-one promise |
| 04 The Math | Picks a price | Live $5K math: sales needed, daily pace |
| 05 The First Line | One click | Writes personalized "Hey — I just wanted to let you know..." DM openers + content hooks |
| 06 7-Day Launch | One click | Assembles their personalized day-by-day launch plan |

Final screen: their complete Launch Kit — copyable and downloadable as a text file.

## Deploy (one time, ~5 minutes)

1. Import this folder as a new Vercel project (set the project root to `the-5k-closer/`).
2. Vercel → Project → Settings → Environment Variables:
   - `ANTHROPIC_API_KEY` — your Anthropic API key (required)
   - `ACCESS_CODE` — optional. Set it to gate the app to paying buyers; they'll be
     asked for the code on their first generation. Leave unset while testing.
3. Edit the `ALLOWED` domain list at the top of `api/closer.js` to your real domain(s).
4. Deploy. The frontend and API ship together; nothing else to wire up.

The methodology prompt lives only in `api/closer.js` (server-side). View-source on
the deployed app reveals none of it.

## Selling it for $27

- Add the app URL (and access code, if set) to your Stan/Beacons product delivery.
- Buyers need no account and no AI subscription — your API key powers generations.
- Rough cost per full buyer run-through is a few cents of API usage at Sonnet pricing.

## Local dev

```bash
npm install
npm run dev        # frontend only; API calls need `vercel dev` or the deployed URL
```
