export const STATUSES = ["Idea", "Drafting", "Ready", "Scheduled", "Published", "Archived"] as const;
export type Status = (typeof STATUSES)[number];

export const FORMATS = ["Text", "Image", "Carousel", "Video", "Poll", "Article"] as const;
export const HOOK_TYPES = [
  "Story",
  "Contrarian",
  "Question",
  "Number / list",
  "Bold claim",
  "Confession",
  "How-to",
  "Data point",
] as const;
export const DEFAULT_PILLARS = [
  "Lessons learned",
  "How-to",
  "Opinion",
  "Story",
  "Industry",
  "Behind the scenes",
  "Wins",
] as const;

export type MetricSource = "API" | "Import" | "Manual";

export interface Metrics {
  impressions: number | null;
  membersReached: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  saves: number | null;
  sends: number | null;
  profileViews: number | null;
  followersGained: number | null;
  linkClicks: number | null;
  /** LinkedIn's own total, used when the per-type breakdown isn't known (creator export). */
  engagements: number | null;
}

export interface Ratings {
  hook: number | null; // 1-5, your own rating
  clarity: number | null;
  value: number | null;
  voice: number | null;
  gut: number | null; // 1-10, "how well will this do?"
}

export interface Post {
  id: string;
  url: string; // Notion page URL
  title: string;
  status: Status;
  text: string;
  pillar: string | null;
  format: string | null;
  hookType: string | null;
  tags: string[];
  ratings: Ratings;
  aiScore: number | null;
  aiNotes: string;
  plannedFor: string | null;
  publishedAt: string | null;
  linkedinUrl: string | null;
  linkedinUrn: string | null;
  metrics: Metrics;
  engagementRate: number | null;
  performanceScore: number | null;
  rank: number | null;
  metricsSource: MetricSource | null;
  lastSynced: string | null;
  createdAt: string;
}

export interface Snapshot {
  id: string;
  postId: string | null;
  capturedAt: string;
  hoursSincePublish: number | null;
  impressions: number | null;
  membersReached: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  saves: number | null;
  sends: number | null;
  source: MetricSource;
}

export interface DailyMetric {
  id: string;
  day: string; // YYYY-MM-DD
  impressions: number | null;
  membersReached: number | null;
  engagements: number | null;
  newFollowers: number | null;
  totalFollowers: number | null;
  profileViews: number | null;
  searchAppearances: number | null;
  source: MetricSource;
}

export interface SwipeItem {
  id: string;
  title: string;
  author: string;
  url: string | null;
  text: string;
  whyItWorks: string;
  hookType: string | null;
  tags: string[];
  rating: number | null;
  createdAt: string;
}

export const emptyMetrics = (): Metrics => ({
  impressions: null,
  membersReached: null,
  reactions: null,
  comments: null,
  reposts: null,
  saves: null,
  sends: null,
  profileViews: null,
  followersGained: null,
  linkClicks: null,
  engagements: null,
});
