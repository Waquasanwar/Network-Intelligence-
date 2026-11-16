# Work Journal

A quick-capture work journal with its own front end and **Notion as the database**. Log thoughts, decisions, requests, comments and wins through the day in one line each. The app tags and categorises them as you type, then turns them into a timeline, a decision log, a requests board and pattern insights.

Everything is stored in the **Work Journal** page in your Notion workspace (Journal Entries, Projects & Areas, People), so you can still use Notion views, mobile and search alongside the app.

## What it does

| Page | Purpose |
| --- | --- |
| **Today** | Capture box, today's log, anything due or needing follow-up, quick counts. |
| **Review** | End-of-day inbox. Each unreviewed entry is pre-filled with guesses (type, category, sentiment, tags); confirm or change, add energy and impact, mark reviewed. |
| **Timeline** | Everything in date order, grouped by day. Search, filter by type, category, tag, project, person, open or overdue. Export the filtered view to CSV. |
| **Requests** | Board of requests by status, with direction (asked of you / you asked), due dates, overdue flags and days open. |
| **Decisions** | Decision log with rationale, alternatives and outcome. Flags decisions over a month old with no outcome. |
| **Insights** | Entries per week, by weekday, time of day vs energy, sentiment by category, top tags, people and projects, who asks you for things, request turnaround, capture streak, and plain-language observations. |

| **Appearance** | Accent colour (Azure, Cobalt, Cyan, Graphite, Emerald, Violet, Amber, Crimson, or any colour), Light / Dark / System, background tint, corner style, sans or serif headings, and body font. Changes apply instantly and are remembered per device. Quick swatches also sit at the bottom of the sidebar. |

Press **C** (or **⌘K**) anywhere to capture. On a phone, add it to the home screen; it runs like an app.

## Capture shorthand

Type naturally. Anything you don't mark is guessed from the wording (shown with ✨, and you can override it).

| Write | Means |
| --- | --- |
| `d:` `r:` `c:` `i:` `m:` `b:` `w:` `q:` `l:` `n:` | Decision, Request, Comment/Feedback, Idea, Meeting, Blocker/Risk, Win, Question, Learning, Note (`decision:`, `risk:`, `til:` etc. also work) |
| `@Sarah` `@Sarah_Khan` `@"Sarah Khan"` | Link a person (created in People if new) |
| `+Migration` `+Q1_Planning` | Link a project (created in Projects & Areas if new) |
| `#budget` | Tag |
| `!1` … `!4` or `!urgent` `!high` `!low` | Priority |
| `due:fri` `due:tomorrow` `due:3d` `due:2w` `due:25/11` `due:2026-12-01` | Due date |
| `fu:mon` `follow:3d` | Follow-up date |
| `<<` / `>>` | Request asked of you / asked by you |
| Shift+Enter | New line; extra lines become the entry's notes in Notion |

Examples:

```
d: go with vendor B, cheaper and SOC2 ready +Data_Migration @James
Can you pull the Q4 headcount numbers @Sarah !2 due:fri
Acme said onboarding felt slow on the call +Acme_Onboarding
m: 1:1 with Tom
- wants more ownership of the roadmap
- worried about workload
```

## Set up

### 1. Connect Notion

1. Go to <https://www.notion.so/profile/integrations>, create an **internal integration**, and copy its secret.
2. In Notion, open the **Work Journal** page → **•••** → **Connections** → add your integration. That shares all three databases with it.

### 2. Run locally

```bash
cd journal
cp .env.example .env.local     # paste NOTION_TOKEN, set APP_PASSCODE and AUTH_SECRET
npm install
npm run dev                    # http://localhost:3100
```

Without `NOTION_TOKEN` the app runs in **demo mode** with sample data held in memory, so you can try it first.

### 3. Deploy (Vercel)

1. Import the repository in Vercel and set **Root Directory** to `journal`.
2. Add the environment variables from `.env.example`: `NOTION_TOKEN`, `APP_PASSCODE`, `AUTH_SECRET` (`openssl rand -base64 32`), `JOURNAL_TIMEZONE`, and optionally `CAPTURE_TOKEN`.
3. Deploy, open it on your phone and **Add to Home Screen**.

The app refuses to serve a Notion-connected journal in production until `APP_PASSCODE` is set.

## Capture from anywhere (API)

Set `CAPTURE_TOKEN` to enable two endpoints. Both take `Authorization: Bearer <CAPTURE_TOKEN>`.

```bash
# Capture (same shorthand as the app)
curl -X POST https://your-app.vercel.app/api/capture \
  -H "Authorization: Bearer $CAPTURE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "r: send board pack to @Sarah due:fri"}'

# Pull your data (JSON), optionally filtered
curl "https://your-app.vercel.app/api/entries?since=2026-10-01&type=Decision" \
  -H "Authorization: Bearer $CAPTURE_TOKEN"
```

**iPhone Shortcut:** New Shortcut → *Ask for Input* (Text) → *Get Contents of URL*: URL `https://your-app.vercel.app/api/capture`, Method POST, Header `Authorization: Bearer <token>`, Request Body JSON with key `text` = Provided Input. Add it to the Home Screen or the Action Button, or say "Hey Siri, journal". The same request works from Raycast, Alfred, Zapier or Make.

## Customising colours

Everything is derived from one accent colour, so picking a swatch (or any colour with **Custom**) re-colours backgrounds, buttons, chips, focus glows and charts together. Accent text is automatically darkened in light mode and lightened in dark mode so it stays readable, even for yellow.

To change the presets or defaults, edit `src/lib/theme.ts` (`PRESETS`, `DEFAULT_THEME`). To adjust the neutrals or how strongly the accent tints surfaces, edit the top of `src/app/globals.css`. Sentiment colours in charts stay a fixed colour-blind-safe blue/orange pair so their meaning never changes with the theme.

## How it's built

- Next.js 15 (App Router, server actions), React 19, Tailwind CSS 4, Recharts.
- `src/lib/notion-repo.ts` reads and writes Notion with the official SDK (data source API). `src/lib/memory-repo.ts` is the demo store. Both implement `src/lib/repo.ts`.
- Reads are cached for 60 seconds and invalidated on every write, to stay under Notion's rate limit.
- `src/lib/parse.ts` is the capture parser and rule-based enrichment; `src/lib/insights.ts` computes the patterns. Both are unit-tested (`npm test`).
- Sign-in is a single passcode; the session cookie is an HMAC, so changing `APP_PASSCODE` or `AUTH_SECRET` signs every device out.

Property names in Notion must stay as they are (`Entry`, `Type`, `Status`, `Tags`, …). You can add new tags, people and projects freely; renaming a property means updating `P` in `notion-repo.ts`.
