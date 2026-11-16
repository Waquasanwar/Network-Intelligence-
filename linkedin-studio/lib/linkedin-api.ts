/**
 * LinkedIn's official APIs. Nothing here scrapes LinkedIn.
 *
 * Works for anyone with a developer app:
 *   openid profile   -> who you are (Sign In with LinkedIn using OpenID Connect)
 *   w_member_social  -> publish posts as you (Share on LinkedIn)
 *
 * Needs LinkedIn's approval (Community Management API):
 *   r_member_postAnalytics -> impressions, reach, reactions, comments, reposts per post,
 *                             plus account totals by day
 *
 * Profile viewers and search appearances have no API for personal profiles.
 * Log them by hand on the Metrics page, or read them off the creator analytics export.
 */
import { decrypt, encrypt } from "./crypto";
import { env } from "./env";
import { deleteConfig, getConfig, setConfig } from "./notion";

const TOKEN_KEY = "linkedin_token";
const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const API = "https://api.linkedin.com";

export interface LinkedInToken {
  accessToken: string;
  expiresAt: number; // epoch ms
  refreshToken?: string;
  refreshExpiresAt?: number;
  scope: string;
  memberId: string; // OpenID `sub`
  name: string;
  picture?: string;
}

export const redirectUri = () => `${env.appUrl()}/api/linkedin/callback`;

export function authorizeUrl(state: string): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: env.linkedin.clientId(),
    redirect_uri: redirectUri(),
    state,
    scope: env.linkedin.scopes(),
  });
  return `${AUTH_URL}?${q}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, client_id: env.linkedin.clientId(), client_secret: env.linkedin.clientSecret() }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`LinkedIn token error: ${json.error_description ?? json.error ?? res.status}`);
  return json as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    scope?: string;
  };
}

export async function exchangeCode(code: string): Promise<LinkedInToken> {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });
  const me = await fetch(`${API}/v2/userinfo`, { headers: { Authorization: `Bearer ${t.access_token}` } });
  if (!me.ok) throw new Error(`LinkedIn userinfo failed (${me.status}). Is the OpenID Connect product added to your app?`);
  const info = (await me.json()) as { sub: string; name?: string; picture?: string };
  const token: LinkedInToken = {
    accessToken: t.access_token,
    expiresAt: Date.now() + t.expires_in * 1000,
    refreshToken: t.refresh_token,
    refreshExpiresAt: t.refresh_token_expires_in ? Date.now() + t.refresh_token_expires_in * 1000 : undefined,
    scope: t.scope ?? env.linkedin.scopes(),
    memberId: info.sub,
    name: info.name ?? "",
    picture: info.picture,
  };
  await saveToken(token);
  return token;
}

async function saveToken(t: LinkedInToken) {
  await setConfig(TOKEN_KEY, encrypt(JSON.stringify(t)));
}

export async function disconnect() {
  await deleteConfig(TOKEN_KEY);
}

/** The stored token, refreshed if LinkedIn issued a refresh token. Null when not connected or expired. */
export async function getToken(): Promise<LinkedInToken | null> {
  const blob = await getConfig(TOKEN_KEY).catch(() => null);
  if (!blob) return null;
  let t: LinkedInToken;
  try {
    t = JSON.parse(decrypt(blob));
  } catch {
    return null;
  }
  if (t.expiresAt - Date.now() > 5 * 60_000) return t;
  if (t.refreshToken && (!t.refreshExpiresAt || t.refreshExpiresAt > Date.now())) {
    const r = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refreshToken });
    t = {
      ...t,
      accessToken: r.access_token,
      expiresAt: Date.now() + r.expires_in * 1000,
      refreshToken: r.refresh_token ?? t.refreshToken,
      refreshExpiresAt: r.refresh_token_expires_in ? Date.now() + r.refresh_token_expires_in * 1000 : t.refreshExpiresAt,
    };
    await saveToken(t);
    return t;
  }
  return null;
}

export const hasScope = (t: LinkedInToken | null, scope: string) => Boolean(t?.scope.split(/[\s,]+/).includes(scope));
export const canPublish = (t: LinkedInToken | null) => hasScope(t, "w_member_social");
export const canReadAnalytics = (t: LinkedInToken | null) => hasScope(t, "r_member_postAnalytics");

function restHeaders(t: LinkedInToken): HeadersInit {
  return {
    Authorization: `Bearer ${t.accessToken}`,
    "LinkedIn-Version": env.linkedin.version(),
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

/** LinkedIn's "little text" format treats these characters as markup, so they must be escaped. */
export function escapeCommentary(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`).replace(/\\#(?=[\p{L}\p{N}_])/gu, "#");
}

/** Publishes a text post as you. Returns the post URN and a link to it. */
export async function publishPost(t: LinkedInToken, text: string): Promise<{ urn: string; url: string }> {
  const res = await fetch(`${API}/rest/posts`, {
    method: "POST",
    headers: { ...restHeaders(t), "Content-Type": "application/json" },
    body: JSON.stringify({
      author: `urn:li:person:${t.memberId}`,
      commentary: escapeCommentary(text),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn publish failed (${res.status}): ${await res.text()}`);
  const urn = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id") ?? "";
  return { urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : "https://www.linkedin.com/feed/" };
}

export const POST_METRICS = ["IMPRESSION", "MEMBERS_REACHED", "REACTION", "COMMENT", "RESHARE"] as const;
export type PostMetricType = (typeof POST_METRICS)[number];

const restliUrn = (urn: string) => encodeURIComponent(urn);

function entityParam(urn: string): string {
  const kind = urn.includes(":ugcPost:") ? "ugcPost" : "share";
  return `(${kind}:${restliUrn(urn)})`;
}

function sumCounts(json: unknown): number | null {
  const els = (json as { elements?: { count?: number }[] })?.elements;
  if (!Array.isArray(els)) return null;
  return els.reduce((a, e) => a + (typeof e.count === "number" ? e.count : 0), 0);
}

/**
 * Lifetime totals for one of your posts (Member Post Analytics API).
 * Returns what it could fetch; each metric that fails is listed in `errors`.
 */
export async function fetchPostAnalytics(t: LinkedInToken, urn: string) {
  const out: Partial<Record<PostMetricType, number>> = {};
  const errors: string[] = [];
  for (const type of POST_METRICS) {
    const url = `${API}/rest/memberCreatorPostAnalytics?q=entity&entity=${entityParam(urn)}&queryType=${type}&aggregation=TOTAL`;
    const res = await fetch(url, { headers: restHeaders(t) });
    if (!res.ok) {
      errors.push(`${type}: ${res.status}`);
      continue;
    }
    const v = sumCounts(await res.json());
    if (v != null) out[type] = v;
  }
  return { metrics: out, errors };
}

const restliDate = (d: Date) => `(day:${d.getUTCDate()},month:${d.getUTCMonth() + 1},year:${d.getUTCFullYear()})`;

/** Account-wide daily totals across all your posts for the given window. */
export async function fetchAccountDaily(t: LinkedInToken, start: Date, end: Date) {
  const days = new Map<string, Partial<Record<PostMetricType, number>>>();
  const errors: string[] = [];
  for (const type of ["IMPRESSION", "MEMBERS_REACHED", "REACTION", "COMMENT", "RESHARE"] as const) {
    const url =
      `${API}/rest/memberCreatorPostAnalytics?q=me&queryType=${type}&aggregation=DAILY` +
      `&dateRange=(start:${restliDate(start)},end:${restliDate(end)})`;
    const res = await fetch(url, { headers: restHeaders(t) });
    if (!res.ok) {
      errors.push(`${type}: ${res.status}`);
      continue;
    }
    const json = (await res.json()) as {
      elements?: { count?: number; dateRange?: { start?: { day: number; month: number; year: number } } }[];
    };
    for (const e of json.elements ?? []) {
      const s = e.dateRange?.start;
      if (!s || typeof e.count !== "number") continue;
      const day = `${s.year}-${String(s.month).padStart(2, "0")}-${String(s.day).padStart(2, "0")}`;
      days.set(day, { ...days.get(day), [type]: e.count });
    }
  }
  return { days, errors };
}

/** Your current follower count, if the token allows it. */
export async function fetchFollowerCount(t: LinkedInToken): Promise<number | null> {
  const res = await fetch(`${API}/rest/memberFollowersCount?q=me`, { headers: restHeaders(t) });
  if (!res.ok) return null;
  const json = (await res.json()) as { elements?: { memberFollowersCount?: number }[] };
  return json.elements?.[0]?.memberFollowersCount ?? null;
}
