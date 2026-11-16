/** Notion database definitions. `npm run setup:notion` creates these under your parent page. */
import { DEFAULT_PILLARS, FORMATS, HOOK_TYPES, STATUSES } from "./types";

const select = (names: readonly string[], colors: string[] = []) => ({
  select: { options: names.map((name, i) => ({ name, color: colors[i] ?? "default" })) },
});
const number = (format = "number") => ({ number: { format } });
const text = () => ({ rich_text: {} });
const date = () => ({ date: {} });

const metricProps = {
  Impressions: number(),
  "Members reached": number(),
  Reactions: number(),
  Comments: number(),
  Reposts: number(),
  Saves: number(),
  Sends: number(),
};

export const POSTS_SCHEMA = {
  Title: { title: {} },
  Status: select(STATUSES, ["gray", "yellow", "blue", "purple", "green", "brown"]),
  Text: text(),
  Pillar: select(DEFAULT_PILLARS),
  Format: select(FORMATS),
  "Hook type": select(HOOK_TYPES),
  Tags: { multi_select: { options: [] } },
  "Rating: hook": number(),
  "Rating: clarity": number(),
  "Rating: value": number(),
  "Rating: voice": number(),
  "Gut score": number(),
  "AI score": number(),
  "AI notes": text(),
  "Planned for": date(),
  "Published at": date(),
  "LinkedIn URL": { url: {} },
  "LinkedIn URN": text(),
  ...metricProps,
  "Profile views": number(),
  "Followers gained": number(),
  "Link clicks": number(),
  Engagements: number(),
  "Engagement rate": number("percent"),
  "Performance score": number(),
  Rank: number(),
  "Metrics source": select(["API", "Import", "Manual"]),
  "Last synced": date(),
};

export const snapshotsSchema = (postsDataSourceId: string) => ({
  Name: { title: {} },
  Post: { relation: { data_source_id: postsDataSourceId, single_property: {} } },
  "Captured at": date(),
  "Hours since publish": number(),
  ...metricProps,
  Source: select(["API", "Import", "Manual"]),
});

export const DAILY_SCHEMA = {
  Name: { title: {} },
  Day: date(),
  Impressions: number(),
  "Members reached": number(),
  Engagements: number(),
  "New followers": number(),
  "Total followers": number(),
  "Profile views": number(),
  "Search appearances": number(),
  Source: select(["API", "Import", "Manual"]),
};

export const SWIPE_SCHEMA = {
  Title: { title: {} },
  Author: text(),
  URL: { url: {} },
  Text: text(),
  "Why it works": text(),
  "Hook type": select(HOOK_TYPES),
  Tags: { multi_select: { options: [] } },
  Rating: number(),
  Added: { created_time: {} },
};

export const CONFIG_SCHEMA = {
  Key: { title: {} },
  Value: text(),
};

import { FUNCTIONS, SENIORITIES } from "./people";

/** Your network, from LinkedIn's data download. One row per connection, keyed by profile URL. */
export const CONNECTIONS_SCHEMA = {
  Name: { title: {} },
  "Profile URL": { url: {} },
  Email: { email: {} },
  Company: text(),
  Position: text(),
  "Connected on": date(),
  Seniority: select(SENIORITIES),
  Function: select(FUNCTIONS),
  "Engaged count": number(),
  "Last engaged": date(),
  "Engaged on": text(),
  Watch: { checkbox: {} },
  "Lead status": select(["Target", "Warming up", "Contacted", "Replied", "Meeting", "Client", "Not a fit"]),
  Notes: text(),
};

/** Who sees your content: demographics from LinkedIn's account and per-post exports. */
export const AUDIENCE_SCHEMA = {
  Name: { title: {} },
  Category: select(["Job titles", "Seniority", "Industries", "Company size", "Locations", "Companies", "Other"]),
  Value: text(),
  Percent: number(),
  Scope: select(["Account", "Post"]),
  "Post ID": text(),
  "Captured on": date(),
};
