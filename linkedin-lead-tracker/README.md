# LinkedIn Lead Tracker

A standalone lead and appointment-setter tracker for growing a LinkedIn following and turning the right people into booked calls. It is separate from the Network Intelligence platform: own server, own data file, no database, no dependencies.

## What it does

| Page | What it's for |
| --- | --- |
| **Today** | Follow-ups due, hot leads nobody has contacted yet, upcoming appointments, and progress against weekly goals (connection requests, conversations, appointments, new followers). |
| **Leads** | Every person, filterable by stage, sector, score and relationship (connection, follows you, follows your page, engaged with a post, viewed your profile, prospect). Export to CSV. |
| **Pipeline** | Drag-and-drop board: New → Warming up → Connection requested → Connected → Messaged → In conversation → Appointment booked → Held → Proposal → Won / Lost / Not a fit. |
| **Sectors** | For each sector: how many leads, followers and engagers, conversations, bookings and wins. Flags sectors you aren't targeting but whose people already follow you. |
| **Growth** | Log profile and Company Page follower counts weekly, see the trend and the sectors your followers come from. |
| **Add & import** | Import LinkedIn's `Connections.csv` (or any CSV), paste lists of followers or post engagers, or add one lead at a time. Duplicates are merged, never doubled. |
| **Targeting** | Your ideal client: sector priorities and keywords, decision-maker titles, target locations, exclusions, weekly goals and message templates. |

Each lead has a drawer with its score and the reasons behind it, one-click activity logging (logging "Message sent", "They replied", "Appointment booked" etc. moves the lead along the pipeline), follow-up shortcuts, message templates filled in with their name, company and sector, and a full history.

### How leads are scored (0–100)

| Signal | Points |
| --- | --- |
| Sector priority High / Medium / Low | 35 / 25 / 15 |
| Title matches one of your decision-maker titles (else a generic senior title such as founder, director, head of) | 25 (else 15) |
| Warmth: follows your page or engaged with your content 15, follows you 12, viewed your profile or is a connection 8; +3 per extra signal | up to 20 |
| Location matches a target location | 10 |
| They engaged with you (replied, accepted, reacted) in the last 30 days | 10 |
| Title, headline or company contains an exclusion keyword | score becomes 0 |

70+ is **hot**, 45–69 **warm**, below 45 **cool**. Sector is detected from the lead's title, headline and company using your keywords; you can override it on any lead.

## Run it

Requires Node 20 or later. Nothing to install.

```bash
cd linkedin-lead-tracker
npm start            # http://127.0.0.1:4300
npm test             # unit tests (node:test)
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4300` | Port to listen on |
| `HOST` | `127.0.0.1` | Set to `0.0.0.0` to reach it from other devices or when deploying |
| `DATA_FILE` | `data/leads.json` | Where everything is stored. A `.bak` copy is taken each time the server starts |
| `APP_PASSWORD` | unset | If set, the browser asks for this password (any username). **Set it whenever `HOST` isn't `127.0.0.1`.** |

To host it (Render, Railway, Fly.io, a small VPS): run `node server.js` with `HOST=0.0.0.0`, an `APP_PASSWORD`, and `DATA_FILE` pointing at a persistent disk. Use HTTPS in front of it, since the password is sent with every request.

Your lead data is personal data about real people. Keep `data/` out of git (it is ignored already), take backups from **Targeting → Your data**, and delete people who ask you to.

## Getting your LinkedIn data in

LinkedIn doesn't offer an API for personal follower lists, post engagers or connection lists, and automating the site (scrapers, auto-connect or auto-message tools) breaks its User Agreement and gets accounts restricted. So this tracker works from what LinkedIn lets you export plus quick manual capture, and you send every message yourself.

1. **Connections:** Me → Settings & Privacy → Data privacy → *Get a copy of your data* → tick *Connections* → download → import `Connections.csv`.
2. **Followers and engagers:** open My Network → Followers, your Company Page → Followers, or a post's reactions and comments. Paste people in as `Name - Title at Company`, one per line, and tick "Follows me", "Follows my page" or "Engaged".
3. **Sales Navigator / CRM exports:** import as CSV. Recognised columns include First/Last Name, Name, URL / Profile URL, Company, Position / Title, Headline, Location, Industry, Email, Notes.

## A weekly rhythm that works

- **Monday:** log follower counts (Growth). Import new connections and paste new followers.
- **Daily (15–20 min):** work the Today page. Engage with two or three hot leads' posts before reaching out (Warming up), send connection requests with a personal note, reply to anyone who has engaged, and set a follow-up date on everyone you touch.
- **Friday:** check Sectors. Write next week's posts for the sectors that follow and book calls, and add any "untapped demand" sector to your targeting.
- Keep connection requests under about 100 a week to stay inside LinkedIn's limits.

## Files

```
server.js          HTTP server and JSON API (no dependencies)
lib/scoring.js     Stages, relationships, sector detection and scoring (shared with the browser)
lib/csv.js         CSV parsing, LinkedIn export mapping, duplicate matching (shared with the browser)
lib/store.js       Lead operations and atomic JSON file storage (server only)
public/            The single-page app (index.html, app.js, styles.css)
test/              Unit tests
```
