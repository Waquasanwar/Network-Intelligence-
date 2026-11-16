# LinkedIn Studio

A personal app for writing LinkedIn posts, rating and ranking them, and tracking what works. **Notion is the database**: every draft, rating, metric and snapshot is a row you can open, edit and build views on in Notion.

- **Write** with a live feed preview (what shows before "…see more"), checks as you type, and an optional Claude writing assistant that scores drafts against *your own* best and worst posts, writes alternative hooks and rewrites on request.
- **Rate** every post yourself (hook, clarity, value, voice, plus a 1–10 gut score) before it goes out.
- **Rank** published posts 0–100 against your own history, with a tier (Breakout / Strong / Solid / Below par).
- **Track** metrics daily (LinkedIn API) or by importing LinkedIn's analytics exports. Each pull is saved as a snapshot, so you can see how a post grows.
- **Learn**: the dashboard shows average performance by pillar, hook type, format, length, weekday and your own hook rating, plus how well your gut score and the AI score actually predicted results.
- **Curate** a swipe file of other people's posts. The ones you rate 4★+ teach the assistant your taste, and "Suggest ideas" draws on them and on your winners.

## Setup (10 minutes)

```bash
cd linkedin-studio
npm install
cp .env.example .env
```

1. **Notion.** Create an internal integration at <https://www.notion.so/my-integrations> and copy its secret into `NOTION_TOKEN`. Make a page called "LinkedIn Studio", open its `•••` menu → *Connections* → add your integration, and put the page's ID (the 32 characters at the end of its URL) in `NOTION_PARENT_PAGE_ID`. Then run:

   ```bash
   npm run setup:notion
   ```

   This creates five databases (Posts, Metric Snapshots, Daily Metrics, Swipe File, Config) and writes their IDs into `.env`.

2. **Writing assistant (optional).** Put an Anthropic API key in `ANTHROPIC_API_KEY`.

3. **Password.** Set `APP_PASSWORD` before you deploy anywhere public.

4. Run it:

   ```bash
   npm run dev
   ```

   Open <http://localhost:3100>.

5. **LinkedIn (optional, recommended).** See [Connecting LinkedIn](#connecting-linkedin) below.

### Deploy

Vercel works out of the box: set the root directory to `linkedin-studio`, copy your `.env` values into the project's environment variables, and set `APP_URL` to the deployed URL. `vercel.json` runs the daily sync at 06:17 UTC (it calls `/api/cron/sync` with `CRON_SECRET`). Anywhere else, schedule `npm run sync`.

## How metrics get in

| Route | Needs | What you get |
|---|---|---|
| **Import account export** (Metrics page) | Nothing | Daily impressions & engagements, daily new followers, total followers, your top 50 posts (impressions + engagements), audience demographics. Up to 365 days per export. |
| **Import single-post export** (Metrics page) | Nothing | That post's impressions, members reached, reactions, comments, reposts, saves, sends, profile views from the post, followers gained. |
| **Type them in** (post page) | Nothing | Anything you can see on LinkedIn. Each save is a snapshot. |
| **Daily sync** | LinkedIn app with `r_member_postAnalytics` (Community Management API approval) | Per-post impressions, members reached, reactions, comments, reposts, every day, with snapshots; account totals by day; follower count. |
| **Weekly log** (Metrics page) | Nothing | Profile viewers and search appearances. |

Imports match LinkedIn posts to your library by post ID. Posts you published by hand get matched once you paste their link on the post page. Unknown posts are added as "Imported post · date" so you can paste the text in and rate them.

## Which LinkedIn metrics exist, and where to get them

For a **personal profile** (not a Company Page):

| Metric | Why it matters | API | Export | Manual |
|---|---|---|---|---|
| Impressions | Reach of each post | ✅ | ✅ | ✅ |
| Members reached (unique viewers) | Real audience size, not repeat views | ✅ | ✅ | ✅ |
| Reactions, comments, reposts | Engagement. Comments and reposts count most | ✅ | ✅ | ✅ |
| Saves, sends | Strongest "this was useful" signals | ❌ | ✅ (post export) | ✅ |
| Profile views from a post | Did the post make people curious about *you*? | ❌ | ✅ (post export) | ✅ |
| Followers gained from a post | Did it grow your audience? | ❌ | ✅ (post export) | ✅ |
| Daily new followers / total followers | Audience growth over time | ✅ (count) | ✅ | ✅ |
| Audience demographics (job title, seniority, industry, company, location) | Are you reaching the people you want? | ❌ | ✅ | |
| Profile viewers (90 days) | Overall pull of your profile | ❌ | ❌ | ✅ |
| Search appearances | How findable you are | ❌ | ❌ | ✅ |
| Video views, watch time | For video posts | Partly (video analytics API) | ✅ | ✅ |
| Link clicks | If you share links | ❌ | Sometimes | ✅ |

What is **not** possible through official routes: who viewed your profile, who engaged beyond what LinkedIn shows you, and scraping. This app uses only LinkedIn's official API and the exports LinkedIn gives you, because scraping breaks LinkedIn's terms and gets accounts restricted.

## Connecting LinkedIn

1. Create an app at <https://www.linkedin.com/developers/apps> (LinkedIn asks you to link a Company Page; your own works).
2. Under **Products**, add *Sign In with LinkedIn using OpenID Connect* and *Share on LinkedIn*. Both are instant.
3. Under **Auth**, add the redirect URL `APP_URL/api/linkedin/callback` (for example `http://localhost:3100/api/linkedin/callback`).
4. Put the client ID and secret in `.env`, set a random 32+ character `APP_SECRET`, restart, and click **Connect LinkedIn** on the Connect page. You can now publish straight from the editor.
5. For automatic analytics, request the **Community Management API** on the same app. LinkedIn reviews it (it wants a registered business and a use-case description). When approved, add `r_member_postAnalytics` to `LINKEDIN_SCOPES`, reconnect, and the daily sync starts pulling numbers.

The token is encrypted with `APP_SECRET` (AES-256-GCM) before being stored in the Notion Config database. LinkedIn tokens last 60 days; the Connect page tells you when to reconnect.

> The analytics endpoints (`memberCreatorPostAnalytics`, `memberFollowersCount`) follow LinkedIn's Member Post Analytics API launched in 2025. LinkedIn versions its API monthly (`LINKEDIN_API_VERSION`); if a sync reports 4xx errors after approval, check the current docs and bump the version.

## How ranking works

Each published post with impressions gets a **performance score** from 0 to 100, relative to your other posts:

- **45% quality**: weighted engagements per 1,000 impressions (reaction ×1, comment ×2, save ×2, send ×2, repost ×3)
- **35% reach**: impressions
- **20% pull**: profile views + followers gained from the post (the weight moves to the other two until you have this data)

Posts are ranked by score. Top 10% (once you have 10+ posts) are **Breakout**; 70+ **Strong**; 40–69 **Solid**; below 40 **Below par**. Scores and ranks are written back to Notion, so you can sort and filter there too. The formula lives in `lib/scoring.ts`.

## Ideas for using the data

- In Notion, add a **Board** view of Posts grouped by Status as a content pipeline, and a **Calendar** view on "Planned for".
- Filter Posts by Rank ≤ 10 for a "greatest hits" view to repurpose.
- Watch the gut-score correlation on the dashboard. If it's low, trust the data over instinct; if it's high, you've learned your audience.
- Export the Daily Metrics database to CSV for your own analysis, or point a Notion chart at it.

## Development

```bash
npm test          # parser, scoring and text-check tests
npm run typecheck
npm run build
```

Code map: `lib/notion.ts` (all Notion reads/writes), `lib/schema.ts` (database columns), `lib/linkedin-export.ts` (xlsx parsers), `lib/linkedin-api.ts` (OAuth, publishing, analytics), `lib/sync.ts` (daily job), `lib/scoring.ts` (ranking and insights), `lib/ai.ts` (Claude), `app/` (pages and server actions).
