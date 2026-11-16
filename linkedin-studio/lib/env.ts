/** Reads configuration lazily so pages can explain what's missing instead of crashing. */
export const env = {
  notionToken: () => process.env.NOTION_TOKEN ?? "",
  notionParentPage: () => process.env.NOTION_PARENT_PAGE_ID ?? "",
  ds: {
    posts: () => process.env.NOTION_POSTS_DS ?? "",
    snapshots: () => process.env.NOTION_SNAPSHOTS_DS ?? "",
    daily: () => process.env.NOTION_DAILY_DS ?? "",
    swipe: () => process.env.NOTION_SWIPE_DS ?? "",
    config: () => process.env.NOTION_CONFIG_DS ?? "",
    connections: () => process.env.NOTION_CONNECTIONS_DS ?? "",
    audience: () => process.env.NOTION_AUDIENCE_DS ?? "",
  },
  anthropicKey: () => process.env.ANTHROPIC_API_KEY ?? "",
  linkedin: {
    clientId: () => process.env.LINKEDIN_CLIENT_ID ?? "",
    clientSecret: () => process.env.LINKEDIN_CLIENT_SECRET ?? "",
    scopes: () => process.env.LINKEDIN_SCOPES ?? "openid profile w_member_social",
    version: () => process.env.LINKEDIN_API_VERSION ?? "202510",
  },
  appUrl: () => (process.env.APP_URL ?? "http://localhost:3100").replace(/\/$/, ""),
  appSecret: () => process.env.APP_SECRET ?? "",
  cronSecret: () => process.env.CRON_SECRET ?? "",
};

export const notionReady = () => Boolean(env.notionToken() && env.ds.posts());
export const aiReady = () => Boolean(env.anthropicKey());
export const linkedinReady = () => Boolean(env.linkedin.clientId() && env.linkedin.clientSecret() && env.appSecret());
