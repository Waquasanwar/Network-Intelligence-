/** Small RFC 4180 style CSV parser and the contact import template. No external dependency. */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === "," || c === "\t") { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export const IMPORT_COLUMNS = [
  { key: "first_name", label: "First name", required: true, aliases: ["firstname", "first", "given name", "given_name", "forename"] },
  { key: "last_name", label: "Last name", required: true, aliases: ["lastname", "last", "surname", "family name", "family_name"] },
  { key: "email", label: "Email", aliases: ["e-mail", "email address", "email_address"] },
  { key: "phone", label: "Phone", aliases: ["mobile", "telephone", "phone number"] },
  { key: "headline", label: "Headline", aliases: ["summary", "title", "tagline"] },
  { key: "company", label: "Company", aliases: ["current company", "organisation", "organization", "employer"] },
  { key: "role", label: "Role", aliases: ["current role", "job title", "position"] },
  { key: "city", label: "City", aliases: ["location", "town"] },
  { key: "country", label: "Country", aliases: [] },
  { key: "capabilities", label: "Capabilities", aliases: ["skills", "expertise", "capability", "specialisms"] },
  { key: "sectors", label: "Sectors", aliases: ["industries", "industry", "sector"] },
  { key: "linkedin", label: "LinkedIn URL", aliases: ["linkedin url", "linkedin_url", "profile url"] },
  { key: "source", label: "Source", aliases: ["how met", "source type"] },
  { key: "relationship", label: "Relationship", aliases: ["relationship type", "how known"] },
  { key: "introduced_by", label: "Introduced by", aliases: ["introducer", "referred by", "via"] },
  { key: "worked_together", label: "Worked together", aliases: ["worked with"] },
  { key: "notes", label: "Private notes", aliases: ["note", "comments", "relationship notes"] },
] as const;

export type ImportColumnKey = (typeof IMPORT_COLUMNS)[number]["key"];

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, " ");

/** Map a header row onto known columns; unknown headers are ignored and reported. */
export function mapHeaders(header: string[]): { map: Partial<Record<ImportColumnKey, number>>; unknown: string[] } {
  const map: Partial<Record<ImportColumnKey, number>> = {};
  const unknown: string[] = [];
  header.forEach((h, i) => {
    const n = norm(h);
    const col = IMPORT_COLUMNS.find((c) => norm(c.key) === n || norm(c.label) === n || c.aliases.some((a) => norm(a) === n));
    if (col && map[col.key] === undefined) map[col.key] = i;
    else if (h.trim()) unknown.push(h.trim());
  });
  return { map, unknown };
}

export const SOURCE_ALIASES: Record<string, string> = {
  "personal network": "PERSONAL_NETWORK", personal: "PERSONAL_NETWORK", network: "PERSONAL_NETWORK", friend: "PERSONAL_NETWORK",
  introduction: "INTRODUCTION", introduced: "INTRODUCTION", referral: "INTRODUCTION", referred: "INTRODUCTION",
  "worked together": "WORKED_TOGETHER", worked: "WORKED_TOGETHER", colleague: "WORKED_TOGETHER", "ex colleague": "WORKED_TOGETHER",
  client: "CLIENT", customer: "CLIENT", "partner referral": "PARTNER_REFERRAL", partner: "PARTNER_REFERRAL",
  event: "EVENT", conference: "EVENT", inbound: "INBOUND", linkedin: "LINKEDIN", other: "OTHER",
};

export const RELATIONSHIP_ALIASES: Record<string, string> = {
  direct: "DIRECT", know: "DIRECT", knows: "DIRECT", introduced: "INTRODUCED", "worked with": "WORKED_WITH", colleague: "WORKED_WITH", worked: "WORKED_WITH",
  managed: "MANAGED", "reported to": "REPORTED_TO", "reports to": "REPORTED_TO", boss: "REPORTED_TO", client: "CLIENT_OF", "client of": "CLIENT_OF",
  peer: "PEER", mentored: "MENTORED", mentee: "MENTORED", "knows of": "KNOWS_OF", acquaintance: "KNOWS_OF",
};

export function templateCsv(): string {
  const header = IMPORT_COLUMNS.map((c) => c.key).join(",");
  const example = [
    "Sarah", "Okonkwo", "sarah@example.com", "", "Programme director who stabilises troubled transformations", "Independent", "Programme Director", "London", "UK",
    "Programme director; Transformation; Systems integrator challenge", "Banking; Insurance", "https://linkedin.com/in/example", "worked together", "worked with", "", "yes", "Best in recovery situations. Prefers a call over email.",
  ].map((v) => (/[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",");
  return `${header}\n${example}\n`;
}
