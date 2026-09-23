/**
 * One agreement per account: membership, what a placement costs, and the contract terms — bundled.
 *
 * These three were scattered: the subscription sat in one card, the fee percentages in another, and
 * the contract terms nowhere at all, with a separate "adjust commission" drawer off to the side.
 * That is three places to look and three things to keep in step, and it is not how anybody thinks
 * about a commercial relationship. An account has *an agreement*. It has a reference, a version, a
 * date somebody agreed it, and three parts you read in order:
 *
 *   1. Membership — what they pay every month for access to the network.
 *   2. Fees        — what they pay when somebody actually starts, route by route.
 *   3. Contract    — payment terms, the rebate, notice, confidentiality, data processing, law.
 *
 * Every number traces to either the tenant's rate card or a deliberate override on this account,
 * and the agreement says which, so a commission adjusted ad hoc is visible rather than buried.
 *
 * Shared by the Next.js app and the browser prototype. No I/O.
 */
import type { AccountKind, RateCard } from "./demand";
import { DEFAULT_RATE_CARD, fmt, subscriptionFor } from "./demand";

export type AgreementStatus = "DRAFT" | "SENT" | "ACTIVE" | "PAUSED" | "ENDED";

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  DRAFT: "Draft — not sent",
  SENT: "Sent, awaiting signature",
  ACTIVE: "Active",
  PAUSED: "Paused",
  ENDED: "Ended",
};

/** What an account may deliberately differ from the rate card on. Everything else follows the card. */
export type AgreementOverrides = {
  monthlyFee?: number | null;
  currency?: string | null;
  /** Per-route percentage overrides, keyed by the fee line's key below. */
  rates?: Record<string, number> | null;
  paymentDays?: number | null;
  rebateDays?: number | null;
  noticeDays?: number | null;
  /** A line the owner wants in this agreement and no other. */
  specialTerms?: string | null;
};

export type AgreementMeta = {
  reference: string;
  status: AgreementStatus;
  version: number;
  agreedAt?: string | null;
  agreedBy?: string | null;
  startedAt?: string | null;
};

export type FeeLineSpec = {
  key: string;
  label: string;
  /** The rate as a number plus how it reads: "18%" or "AED 9,000". */
  value: string;
  basis: string;
  /** True when this account differs from the tenant rate card here. */
  overridden: boolean;
  cardValue: string;
};

export type Clause = { key: string; heading: string; body: string };

export type Agreement = {
  accountId: string;
  accountName: string;
  kind: AccountKind;
  meta: AgreementMeta;
  membership: {
    tier: string;
    monthly: number;
    currency: string;
    annual: number;
    includes: string[];
    overridden: boolean;
    cardMonthly: number;
  };
  fees: FeeLineSpec[];
  contract: Clause[];
  /** One sentence a person could say out loud about the whole thing. */
  summary: string;
};

const pctStr = (n: number) => `${n}%`;

/** Reference an account can quote on an invoice. Stable for the life of the agreement. */
export function agreementReference(accountId: string, startedAt?: string | null): string {
  const year = startedAt ? new Date(startedAt).getFullYear() : new Date().getFullYear();
  const tail = accountId.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase().padStart(4, "0");
  return `AMANA-${year}-${tail}`;
}

/** What membership opens, in the words the person paying would use. */
export function membershipIncludes(kind: AccountKind): string[] {
  const base = [
    "Search every expert who has agreed to be found",
    "Anonymised profiles: capability, region, availability, right to work, trust",
    "Ask us to unlock anyone who interests you — we ask them first",
    "Bring us roles in plain words; we read them back before we search",
  ];
  if (kind === "AGENCY") {
    return [...base, "Propose our experts into your own client requirements, anonymised", "Refer people you know into the network and earn on them"];
  }
  return base;
}

/**
 * The fee schedule for this kind of account. A client is never shown the lines about an agency's
 * own margin, because they are not party to them.
 */
function feeLines(kind: AccountKind, card: RateCard, over: AgreementOverrides): FeeLineSpec[] {
  const r = over.rates ?? {};
  const line = (key: string, label: string, cardPct: number, basis: string): FeeLineSpec => {
    const has = typeof r[key] === "number";
    const val = has ? r[key] : cardPct;
    return { key, label, value: pctStr(val), basis, overridden: has && val !== cardPct, cardValue: pctStr(cardPct) };
  };

  if (kind === "AGENCY") {
    return [
      line("agencyReferralSharePct", "Permanent placements", card.agencyReferralSharePct, `Our share of your fee to your client. On your standard ${card.agencyPermPct}% of first-year salary, that is our cut of the fee you invoice.`),
      line("agencyContractSharePct", "Contract, interim and fractional", card.agencyContractSharePct, `Our share of your margin on the billed day rate, for the length of the engagement.`),
      { key: "introductionFee", label: "Introduction only", value: fmt(over.rates?.introductionFee ?? card.introductionFee, over.currency ?? card.currency), basis: "Where a percentage does not fit — a flat fee per introduction, agreed before we make it.", overridden: typeof r.introductionFee === "number" && r.introductionFee !== card.introductionFee, cardValue: fmt(card.introductionFee, card.currency) },
    ];
  }
  if (kind === "EXPERT_NETWORK") {
    return [
      line("expertHourlyTakePct", "Expert calls", card.expertHourlyTakePct, "Platform take on the expert's hourly rate. The expert receives the rest."),
      line("sowSharePct", "SOW and project teams", card.sowSharePct, "Our share of the SOW value, for people we bring to the team."),
    ];
  }
  return [
    line("permPct", "Permanent hires", card.permPct, "Of first-year base salary, invoiced on the start date."),
    line("contractMarginPct", "Contract, interim and fractional", card.contractMarginPct, "Of the billed day rate, for the length of the engagement."),
    line("expertHourlyTakePct", "Expert calls", card.expertHourlyTakePct, "Of the expert's hourly rate, where you want an hour rather than a hire."),
    { key: "introductionFee", label: "Introduction only", value: fmt(over.rates?.introductionFee ?? card.introductionFee, over.currency ?? card.currency), basis: "Where a percentage does not fit — a flat fee per introduction, agreed before we make it.", overridden: typeof r.introductionFee === "number" && r.introductionFee !== card.introductionFee, cardValue: fmt(card.introductionFee, card.currency) },
  ];
}

export const DEFAULT_PAYMENT_DAYS = 14;
export const DEFAULT_REBATE_DAYS = 90;
export const DEFAULT_NOTICE_DAYS = 30;

/**
 * The contract, in clauses somebody would actually read. Written so that the obligation is on us
 * wherever it reasonably can be, because that is the thing worth putting in writing.
 */
function clauses(kind: AccountKind, over: AgreementOverrides): Clause[] {
  const pay = over.paymentDays ?? DEFAULT_PAYMENT_DAYS;
  const rebate = over.rebateDays ?? DEFAULT_REBATE_DAYS;
  const notice = over.noticeDays ?? DEFAULT_NOTICE_DAYS;
  const out: Clause[] = [
    { key: "when", heading: "When a fee becomes due", body: `On the person's first day, and not before it. Nothing is payable for a shortlist, a conversation, an interview, or somebody who does not take the role.` },
    { key: "payment", heading: "Payment terms", body: `${pay} days from the date of invoice. Invoices are raised in the currency of this agreement.` },
    { key: "rebate", heading: "If it does not work out", body: `If the person leaves or is released within ${rebate} days of starting, we refund on a sliding scale — the whole fee in the first 30 days, half to ${Math.round(rebate / 2)} days, a quarter to ${rebate}. We would rather replace them, and will try first.` },
    { key: "exclusivity", heading: "Exclusivity", body: `None. You are free to work with anybody else on the same role, and you owe us nothing if they fill it first.` },
    { key: "membership", heading: "Membership and notice", body: `Membership is billed monthly in advance and either side can end it with ${notice} days' notice. Fees already earned on a placement survive the end of membership; nothing else does.` },
    { key: "consent", heading: "Names and consent", body: `We show you anonymised profiles. A name is released only after we have asked that person about your specific role and they have agreed. If they withdraw consent, the profile disappears from your view immediately — including cards already on your shortlist.` },
    { key: "confidentiality", heading: "Confidentiality", body: `Your requirements, your rates and the fact of this agreement are confidential to us. Profiles we show you are confidential to you: they are not to be forwarded, re-posted or added to another database.` },
    { key: "data", heading: "Data protection", body: `We are the controller for the network's own records and a processor for what you give us about your roles. Handled to the stricter reading of UK GDPR and the Data Protection Act 2018 and of UAE Federal Decree-Law No. 45 of 2021. Retention periods, and the point at which data is deleted or anonymised, are published in the platform and apply to this agreement.` },
    { key: "law", heading: "Governing law", body: `The laws of the Emirate of Dubai and the applicable federal laws of the United Arab Emirates, with the courts of the DIFC having jurisdiction.` },
  ];
  if (kind === "AGENCY") {
    out.splice(4, 0, { key: "licence", heading: "Who places the person", body: `You hold the licence and the relationship with your client; you make the placement and invoice them. We introduce and take a share of what you earn. We do not contract with your client directly on a role you brought us.` });
  }
  if (over.specialTerms) out.push({ key: "special", heading: "Agreed specifically with you", body: over.specialTerms });
  return out;
}

/** Build the whole agreement for an account. Pure: the same inputs always give the same document. */
export function buildAgreement(
  account: { id: string; name: string; kind: AccountKind; currency?: string | null; monthlyFee?: number | null; createdAt?: string | null },
  card: RateCard = DEFAULT_RATE_CARD,
  over: AgreementOverrides = {},
  meta: Partial<AgreementMeta> = {},
): Agreement {
  const sub = subscriptionFor(account.kind, card);
  const currency = over.currency ?? sub.currency;
  const monthly = over.monthlyFee ?? account.monthlyFee ?? sub.amount;
  const startedAt = meta.startedAt ?? account.createdAt ?? null;
  const fees = feeLines(account.kind, card, over);
  const tier = account.kind === "AGENCY" ? "Agency membership" : account.kind === "EXPERT_NETWORK" ? "Expert network" : "Client membership";

  const m: AgreementMeta = {
    reference: meta.reference ?? agreementReference(account.id, startedAt),
    status: meta.status ?? "ACTIVE",
    version: meta.version ?? 1,
    agreedAt: meta.agreedAt ?? null,
    agreedBy: meta.agreedBy ?? null,
    startedAt,
  };

  const headline = fees[0];
  const summary = monthly > 0
    ? `${fmt(monthly, currency)} a month for access, and ${headline ? `${headline.value} ${account.kind === "AGENCY" ? "of what you earn" : "when somebody starts"}` : "a fee on a placement"}. Nothing else.`
    : `No monthly fee. ${headline ? `${headline.value} ${account.kind === "AGENCY" ? "of what you earn" : "when somebody starts"}.` : "Fees on placement only."}`;

  return {
    accountId: account.id,
    accountName: account.name,
    kind: account.kind,
    meta: m,
    membership: {
      tier, monthly, currency, annual: monthly * 12,
      includes: membershipIncludes(account.kind),
      overridden: monthly !== sub.amount,
      cardMonthly: sub.amount,
    },
    fees,
    contract: clauses(account.kind, over),
    summary,
  };
}

/** Everything on this agreement that differs from the tenant's standard terms. */
export function departures(a: Agreement): string[] {
  const out: string[] = [];
  if (a.membership.overridden) out.push(`Membership is ${fmt(a.membership.monthly, a.membership.currency)} rather than the standard ${fmt(a.membership.cardMonthly, a.membership.currency)}.`);
  for (const f of a.fees) if (f.overridden) out.push(`${f.label} is ${f.value} rather than the standard ${f.cardValue}.`);
  const special = a.contract.find((c) => c.key === "special");
  if (special) out.push(special.body);
  return out;
}

/** What this account is worth in a year if nothing else happens: membership alone. */
export function recurringValue(a: Agreement): { monthly: number; annual: number; currency: string } {
  return { monthly: a.membership.monthly, annual: a.membership.annual, currency: a.membership.currency };
}

