// CSV parsing and LinkedIn-export column mapping. Runs in Node and in the browser.

/** RFC 4180 style parser. Handles quoted fields, escaped quotes, CRLF and a BOM. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = String(text).replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export function toCsv(rows) {
  const cell = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

const norm = (s) => String(s).trim().toLowerCase().replace(/[\s_-]+/g, " ");

// Field -> header aliases. Covers LinkedIn's Connections.csv, Sales Navigator / CRM exports and hand-made sheets.
export const COLUMN_ALIASES = {
  firstName: ["first name", "firstname", "first", "given name"],
  lastName: ["last name", "lastname", "last", "surname", "family name"],
  fullName: ["name", "full name", "fullname", "contact name"],
  profileUrl: ["url", "profile url", "linkedin url", "linkedin", "linkedin profile", "profile", "public profile url"],
  email: ["email address", "email", "e mail"],
  company: ["company", "company name", "organization", "organisation", "employer", "current company", "account name"],
  position: ["position", "title", "job title", "current title", "role", "current role"],
  headline: ["headline", "tagline", "summary"],
  location: ["location", "city", "geography", "region", "country"],
  connectedOn: ["connected on", "connected", "connection date", "followed on", "date"],
  sector: ["industry", "sector", "company industry"],
  notes: ["notes", "note", "comments"],
};

/**
 * Find the header row. LinkedIn's Connections.csv starts with a "Notes:" preamble before the
 * real header, so we scan the first rows for one that contains a recognisable name column.
 */
export function findHeaderRow(rows) {
  const nameish = new Set([...COLUMN_ALIASES.firstName, ...COLUMN_ALIASES.fullName].map(norm));
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if (rows[i].some((c) => nameish.has(norm(c)))) return i;
  }
  return -1;
}

export function mapHeaders(header) {
  const map = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (map[key] === undefined && aliases.includes(n)) { map[key] = i; break; }
    }
  });
  return map;
}

/** Turn CSV text into plain lead objects. Returns { leads, skipped, error }. */
export function csvToLeads(text) {
  const rows = parseCsv(text);
  const h = findHeaderRow(rows);
  if (h === -1) return { leads: [], skipped: 0, error: "Couldn't find a header row with a name column (e.g. 'First Name' or 'Name')." };
  const map = mapHeaders(rows[h]);
  const get = (r, k) => (map[k] === undefined ? "" : (r[map[k]] ?? "").trim());
  const leads = [];
  let skipped = 0;
  for (const r of rows.slice(h + 1)) {
    let firstName = get(r, "firstName");
    let lastName = get(r, "lastName");
    if (!firstName && !lastName && get(r, "fullName")) {
      const parts = get(r, "fullName").split(/\s+/);
      firstName = parts.shift() ?? "";
      lastName = parts.join(" ");
    }
    if (!firstName && !lastName) { skipped++; continue; }
    leads.push({
      firstName, lastName,
      profileUrl: get(r, "profileUrl"),
      email: get(r, "email"),
      company: get(r, "company"),
      position: get(r, "position"),
      headline: get(r, "headline"),
      location: get(r, "location"),
      connectedOn: get(r, "connectedOn"),
      sector: get(r, "sector"),
      notes: get(r, "notes"),
    });
  }
  return { leads, skipped, error: null };
}

/** Canonical form of a LinkedIn profile URL so the same person isn't imported twice. */
export function normaliseProfileUrl(url) {
  if (!url) return "";
  const m = String(url).trim().toLowerCase().match(/linkedin\.com\/(in|company)\/([^/?#\s]+)/);
  return m ? `linkedin.com/${m[1]}/${decodeURIComponent(m[2])}` : String(url).trim().toLowerCase();
}

const nameKey = (l) => `${norm(l.firstName ?? "")}|${norm(l.lastName ?? "")}`;

/**
 * Find the existing lead that is the same person. A profile URL is decisive when both sides have
 * one. Otherwise match on name, plus company when both sides know it; a bare name only matches
 * when exactly one lead has it, so two different "John Smith"s never get merged.
 */
export function findDuplicate(leads, lead) {
  const url = normaliseProfileUrl(lead.profileUrl);
  if (url) {
    const byUrl = leads.find((l) => normaliseProfileUrl(l.profileUrl) === url);
    if (byUrl) return byUrl;
  }
  const sameName = leads.filter((l) => nameKey(l) === nameKey(lead) && !(url && l.profileUrl));
  if (!sameName.length) return null;
  const company = norm(lead.company ?? "");
  if (company) {
    const withCompany = sameName.find((l) => norm(l.company ?? "") === company);
    if (withCompany) return withCompany;
    return sameName.length === 1 && !sameName[0].company ? sameName[0] : null;
  }
  return sameName.length === 1 ? sameName[0] : null;
}
