/**
 * Creates the five Notion databases under NOTION_PARENT_PAGE_ID and writes their IDs into .env.
 *   npm run setup:notion
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Client } from "@notionhq/client";
import { AUDIENCE_SCHEMA, CONFIG_SCHEMA, CONNECTIONS_SCHEMA, DAILY_SCHEMA, POSTS_SCHEMA, SWIPE_SCHEMA, snapshotsSchema } from "../lib/schema";

const token = process.env.NOTION_TOKEN;
const parent = process.env.NOTION_PARENT_PAGE_ID?.replace(/-/g, "").match(/[0-9a-f]{32}/i)?.[0];
if (!token || !parent) {
  console.error("Set NOTION_TOKEN and NOTION_PARENT_PAGE_ID in .env first (see .env.example).");
  process.exit(1);
}
const notion = new Client({ auth: token });

async function create(title: string, emoji: string, properties: Record<string, unknown>) {
  const db = (await notion.databases.create({
    parent: { type: "page_id", page_id: parent! },
    title: [{ type: "text", text: { content: title } }],
    icon: { type: "emoji", emoji } as never,
    initial_data_source: { properties } as never,
  })) as { id: string; data_sources?: { id: string }[] };
  const ds = db.data_sources?.[0]?.id;
  if (!ds) throw new Error(`Created "${title}" but Notion returned no data source id.`);
  console.log(`  ✓ ${title}`);
  return ds;
}

async function main() {
  // Creates only what's missing, so re-running after an upgrade adds the new databases.
  const force = process.argv.includes("--force");
  const have = (k: string) => !force && process.env[k];
  console.log("Checking Notion databases…");
  const ids: Record<string, string> = {};
  const posts = have("NOTION_POSTS_DS") || (ids.NOTION_POSTS_DS = await create("LinkedIn Posts", "✍️", POSTS_SCHEMA));
  if (!have("NOTION_SNAPSHOTS_DS")) ids.NOTION_SNAPSHOTS_DS = await create("LinkedIn Metric Snapshots", "📈", snapshotsSchema(posts as string));
  if (!have("NOTION_DAILY_DS")) ids.NOTION_DAILY_DS = await create("LinkedIn Daily Metrics", "📅", DAILY_SCHEMA);
  if (!have("NOTION_SWIPE_DS")) ids.NOTION_SWIPE_DS = await create("LinkedIn Swipe File", "🗂️", SWIPE_SCHEMA);
  if (!have("NOTION_CONFIG_DS")) ids.NOTION_CONFIG_DS = await create("LinkedIn Studio Config", "⚙️", CONFIG_SCHEMA);
  if (!have("NOTION_CONNECTIONS_DS")) ids.NOTION_CONNECTIONS_DS = await create("LinkedIn Network", "🤝", CONNECTIONS_SCHEMA);
  if (!have("NOTION_AUDIENCE_DS")) ids.NOTION_AUDIENCE_DS = await create("LinkedIn Audience", "🎯", AUDIENCE_SCHEMA);
  if (!Object.keys(ids).length) {
    console.log("Everything is already set up.");
    return;
  }

  if (existsSync(".env")) {
    let env = readFileSync(".env", "utf8");
    for (const [k, v] of Object.entries(ids)) {
      const re = new RegExp(`^${k}=.*$`, "m");
      env = re.test(env) ? env.replace(re, `${k}=${v}`) : `${env.trimEnd()}\n${k}=${v}\n`;
    }
    writeFileSync(".env", env);
    console.log("\nSaved the IDs to .env.");
  } else {
    console.log("\nAdd these to your environment:\n");
  }
  for (const [k, v] of Object.entries(ids)) console.log(`${k}=${v}`);
  console.log("\nTip: in Notion, add a Board view grouped by Status to the Posts database for a content pipeline.");
}

main().catch((e) => {
  console.error(e.body ?? e.message ?? e);
  process.exit(1);
});
