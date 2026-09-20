/**
 * Trust score (0–100): how many people in the network stand behind someone, and how well
 * the network knows them. It is built from vouches, direct working relationships, observed
 * evidence, approved conversations, a completed screening and a fresh status.
 *
 * It is a measure of *network confidence*, not a judgement of the person. Cautions lower it
 * because they mean "read this before positioning", never because the person is "bad".
 * Shared by the Next.js app and the browser prototype. No I/O.
 */

export type TrustInput = {
  vouches: { wouldRecommend: boolean; external?: boolean }[]; // external = e.g. a LinkedIn recommendation, weighted lower
  workedWith: number; // relationships with workedTogether = true
  wouldWorkAgain: number; // relationships explicitly saying "would work together again"
  evidence: number; // non-caution evidence pieces
  cautions: number;
  approvedConversations: number;
  screened: boolean;
  freshness: "fresh" | "aging" | "stale" | "unknown";
  referralsAccepted?: number; // referrals this person made that were accepted into the network
};

export type TrustBand = "unknown" | "emerging" | "known" | "trusted" | "highly trusted";

export type TrustScore = {
  score: number;
  band: TrustBand;
  vouchedBy: number;
  breakdown: { label: string; points: number; max: number; note: string }[];
};

export const TRUST_BAND_LABEL: Record<TrustBand, string> = { unknown: "Not yet known", emerging: "Emerging", known: "Known", trusted: "Trusted", "highly trusted": "Highly trusted" };

export function trustBand(score: number): TrustBand {
  if (score >= 80) return "highly trusted";
  if (score >= 60) return "trusted";
  if (score >= 35) return "known";
  if (score >= 12) return "emerging";
  return "unknown";
}

export function trustScore(i: TrustInput): TrustScore {
  const network = i.vouches.filter((v) => v.wouldRecommend && !v.external).length;
  const external = i.vouches.filter((v) => v.wouldRecommend && v.external).length;
  const positive = network + external;
  const vouchPts = Math.min(35, network * 9 + Math.min(10, external * 4));
  const workedPts = Math.min(20, i.workedWith * 10 + Math.min(5, i.wouldWorkAgain * 5));
  const evidencePts = Math.min(20, i.evidence * 7);
  const convPts = Math.min(10, i.approvedConversations * 5);
  const screenPts = i.screened ? 10 : 0;
  const freshPts = i.freshness === "fresh" ? 5 : i.freshness === "aging" ? 2 : 0;
  const referralPts = Math.min(5, (i.referralsAccepted ?? 0) * 2.5);
  const cautionPts = -8 * i.cautions;
  const raw = vouchPts + workedPts + evidencePts + convPts + screenPts + freshPts + referralPts + cautionPts;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const breakdown = [
    { label: "Vouched for", points: vouchPts, max: 35, note: positive ? `${network} ${network === 1 ? "person" : "people"} in the network would recommend them${external ? `, plus ${external} external recommendation${external === 1 ? "" : "s"}` : ""}` : "Nobody has vouched yet" },
    { label: "Worked with directly", points: workedPts, max: 20, note: i.workedWith ? `${i.workedWith} direct working relationship${i.workedWith === 1 ? "" : "s"}${i.wouldWorkAgain ? ", would work together again" : ""}` : "No one has worked with them directly" },
    { label: "Observed evidence", points: evidencePts, max: 20, note: i.evidence ? `${i.evidence} piece${i.evidence === 1 ? "" : "s"} of delivery evidence` : "No observed evidence recorded" },
    { label: "Conversations", points: convPts, max: 10, note: i.approvedConversations ? `${i.approvedConversations} approved conversation${i.approvedConversations === 1 ? "" : "s"}` : "No approved conversation yet" },
    { label: "Screening", points: screenPts, max: 10, note: i.screened ? "Screening call completed" : "Screening call not done" },
    { label: "Status freshness", points: freshPts, max: 5, note: i.freshness === "fresh" ? "Availability confirmed recently" : `Availability is ${i.freshness}` },
  ];
  if (i.referralsAccepted) breakdown.push({ label: "Referrals accepted", points: referralPts, max: 5, note: `${i.referralsAccepted} referral${i.referralsAccepted === 1 ? "" : "s"} accepted into the network` });
  if (i.cautions) breakdown.push({ label: "Cautions", points: cautionPts, max: 0, note: `${i.cautions} caution${i.cautions === 1 ? "" : "s"} recorded. Read before positioning.` });
  return { score, band: trustBand(score), vouchedBy: positive, breakdown };
}
