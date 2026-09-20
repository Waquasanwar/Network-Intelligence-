"use server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireInternalAction } from "@/server/session";
import { parseCsv, mapHeaders, SOURCE_ALIASES, RELATIONSHIP_ALIASES, type ImportColumnKey } from "@/lib/csv";
import * as XLSX from "xlsx";
import type { RelationshipType, SourceType } from "@prisma/client";

export type ImportRow = {
  line: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  headline: string | null;
  company: string | null;
  role: string | null;
  city: string | null;
  country: string | null;
  capabilities: string[];
  sectors: string[];
  linkedin: string | null;
  source: SourceType;
  relationship: RelationshipType;
  introducedBy: string | null;
  workedTogether: boolean;
  notes: string | null;
  issues: string[]; // blocking
  warnings: string[];
  duplicateOf: string | null; // existing person id
};

export type ImportPreview = {
  ok: boolean;
  error?: string;
  rows: ImportRow[];
  unknownHeaders: string[];
  mappedColumns: string[];
  totals: { total: number; ready: number; blocked: number; duplicates: number };
};

const VALID_SOURCES = new Set(["PERSONAL_NETWORK", "INTRODUCTION", "WORKED_TOGETHER", "CLIENT", "PARTNER_REFERRAL", "EVENT", "INBOUND", "LINKEDIN", "OTHER"]);
const VALID_RELS = new Set(["DIRECT", "INTRODUCED", "WORKED_WITH", "MANAGED", "REPORTED_TO", "CLIENT_OF", "PEER", "MENTORED", "KNOWS_OF"]);

const list = (s: string | null) => (s ? s.split(/[;,|\n]/).map((x) => x.trim()).filter(Boolean) : []);
const yes = (s: string | null) => !!s && /^(y|yes|true|1)$/i.test(s.trim());

function normaliseEnum(raw: string | null, aliases: Record<string, string>, valid: Set<string>, fallback: string): { value: string; warning?: string } {
  if (!raw || !raw.trim()) return { value: fallback };
  const up = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (valid.has(up)) return { value: up };
  const alias = aliases[raw.trim().toLowerCase()];
  if (alias) return { value: alias };
  return { value: fallback, warning: `"${raw.trim()}" not recognised; using ${fallback.toLowerCase().replace(/_/g, " ")}` };
}

/** Parse and validate CSV or pasted text. Nothing is written. */
export async function previewImport(_prev: ImportPreview | null, formData: FormData): Promise<ImportPreview> {
  const user = await requireInternalAction();
  const file = formData.get("file");
  let text = String(formData.get("text") || "");
  let grid: string[][] | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 5_000_000) return { ok: false, error: "File is larger than 5 MB. Split it and import in batches.", rows: [], unknownHeaders: [], mappedColumns: [], totals: { total: 0, ready: 0, blocked: 0, duplicates: 0 } };
    if (/\.xlsx?$|\.xlsm$/i.test(file.name)) {
      try {
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const name = wb.SheetNames.find((n) => /contacts|people|network/i.test(n)) ?? wb.SheetNames[0];
        grid = (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "" }) as string[][]).map((r) => r.map((v) => String(v ?? "").trim()));
      } catch {
        return { ok: false, error: "Could not open that workbook. Save it as .xlsx and try again, or paste the rows.", rows: [], unknownHeaders: [], mappedColumns: [], totals: { total: 0, ready: 0, blocked: 0, duplicates: 0 } };
      }
    } else text = await file.text();
  }
  if (!grid && !text.trim()) return { ok: false, error: "Choose an Excel or CSV file, or paste rows first.", rows: [], unknownHeaders: [], mappedColumns: [], totals: { total: 0, ready: 0, blocked: 0, duplicates: 0 } };

  const defaultSource = String(formData.get("defaultSource") || "PERSONAL_NETWORK");
  const defaultRel = String(formData.get("defaultRelationship") || "DIRECT");
  grid = grid ?? parseCsv(text);
  grid = grid.filter((r) => r.some((v) => v.trim() !== ""));
  if (grid.length < 2) return { ok: false, error: "Need a header row and at least one contact row.", rows: [], unknownHeaders: [], mappedColumns: [], totals: { total: 0, ready: 0, blocked: 0, duplicates: 0 } };
  const { map, unknown } = mapHeaders(grid[0]);
  if (map.first_name === undefined && map.last_name === undefined) {
    return { ok: false, error: `No name columns found. Headers seen: ${grid[0].join(", ")}. Use the template or include first_name and last_name.`, rows: [], unknownHeaders: unknown, mappedColumns: [], totals: { total: 0, ready: 0, blocked: 0, duplicates: 0 } };
  }
  const get = (r: string[], k: ImportColumnKey) => (map[k] === undefined ? null : (r[map[k] as number] ?? "").trim() || null);

  const existing = await prisma.person.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true, email: true } });
  const byEmail = new Map(existing.filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p.id]));
  const byName = new Map(existing.map((p) => [`${p.firstName} ${p.lastName}`.toLowerCase(), p.id]));
  const seenInFile = new Set<string>();

  const rows: ImportRow[] = grid.slice(1, 2001).map((r, i) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    let firstName = get(r, "first_name") ?? "";
    let lastName = get(r, "last_name") ?? "";
    if (!lastName && firstName.includes(" ")) { const parts = firstName.split(/\s+/); firstName = parts.shift() ?? ""; lastName = parts.join(" "); warnings.push("Split full name into first and last"); }
    if (!firstName) issues.push("First name is missing");
    if (!lastName) issues.push("Last name is missing");
    const email = get(r, "email")?.toLowerCase() ?? null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push("Email is not valid");
    const src = normaliseEnum(get(r, "source"), SOURCE_ALIASES, VALID_SOURCES, defaultSource);
    const rel = normaliseEnum(get(r, "relationship"), RELATIONSHIP_ALIASES, VALID_RELS, defaultRel);
    if (src.warning) warnings.push(src.warning);
    if (rel.warning) warnings.push(rel.warning);
    const key = email ?? `${firstName} ${lastName}`.toLowerCase();
    let duplicateOf: string | null = (email && byEmail.get(email)) || byName.get(`${firstName} ${lastName}`.toLowerCase()) || null;
    if (seenInFile.has(key)) { issues.push("Duplicate row in this file"); duplicateOf = duplicateOf ?? "file"; }
    seenInFile.add(key);
    if (duplicateOf && duplicateOf !== "file") warnings.push("Already in the network; will be skipped");
    const worked = yes(get(r, "worked_together")) || rel.value === "WORKED_WITH" || src.value === "WORKED_TOGETHER";
    return {
      line: i + 2,
      firstName, lastName, email,
      phone: get(r, "phone"), headline: get(r, "headline"), company: get(r, "company"), role: get(r, "role"), city: get(r, "city"), country: get(r, "country"),
      capabilities: list(get(r, "capabilities")), sectors: list(get(r, "sectors")), linkedin: get(r, "linkedin"),
      source: src.value as SourceType, relationship: rel.value as RelationshipType,
      introducedBy: get(r, "introduced_by"), workedTogether: worked, notes: get(r, "notes"),
      issues, warnings, duplicateOf,
    };
  });
  const blocked = rows.filter((r) => r.issues.length).length;
  const duplicates = rows.filter((r) => r.duplicateOf && r.duplicateOf !== "file" && !r.issues.length).length;
  return { ok: true, rows, unknownHeaders: unknown, mappedColumns: Object.keys(map), totals: { total: rows.length, ready: rows.length - blocked - duplicates, blocked, duplicates } };
}

export type ImportResult = { ok: boolean; error?: string; created: number; skipped: number; linkedIntroducers: number };

/** Write the previewed rows. Skips rows with issues and existing duplicates. */
export async function commitImport(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  const user = await requireInternalAction();
  let rows: ImportRow[];
  try {
    rows = JSON.parse(String(formData.get("rows") || "[]")) as ImportRow[];
  } catch {
    return { ok: false, error: "Preview data was not readable. Run the preview again.", created: 0, skipped: 0, linkedIntroducers: 0 };
  }
  const toCreate = rows.filter((r) => r.issues.length === 0 && (!r.duplicateOf || r.duplicateOf === "file") && r.firstName && r.lastName).slice(0, 2000);
  if (!toCreate.length) return { ok: false, error: "Nothing to import: every row is blocked or already in the network.", created: 0, skipped: rows.length, linkedIntroducers: 0 };

  const createdIds = new Map<string, string>();
  for (const r of toCreate) {
    const p = await prisma.person.create({
      data: {
        tenantId: user.tenantId,
        firstName: r.firstName.slice(0, 80),
        lastName: r.lastName.slice(0, 80),
        email: r.email?.slice(0, 200) ?? null,
        phone: r.phone?.slice(0, 40) ?? null,
        headline: r.headline?.slice(0, 200) ?? null,
        currentCompany: r.company?.slice(0, 120) ?? null,
        currentRole: r.role?.slice(0, 120) ?? null,
        primaryCity: r.city?.slice(0, 80) ?? null,
        primaryCountry: r.country?.slice(0, 80) ?? null,
        capabilities: r.capabilities.slice(0, 30).map((c) => c.slice(0, 80)),
        sectors: r.sectors.slice(0, 20).map((c) => c.slice(0, 80)),
        linkedinUrl: r.linkedin && /^https?:\/\//i.test(r.linkedin) ? r.linkedin.slice(0, 300) : null,
        availabilityStatus: "NEEDS_REFRESH",
        nextAction: "Book first conversation",
        relationships: {
          create: {
            networkOwnerId: user.id,
            sourceType: r.source,
            relationshipType: r.relationship,
            workedTogether: r.workedTogether,
            relationshipNotes: r.notes?.slice(0, 4000) ?? null,
            lastContactDate: new Date(),
          },
        },
      },
      select: { id: true },
    });
    createdIds.set(`${r.firstName} ${r.lastName}`.toLowerCase(), p.id);
  }

  // Second pass: link introducers by name, whether they were in this file or already in the network.
  const all = await prisma.person.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true } });
  const byName = new Map(all.map((p) => [`${p.firstName} ${p.lastName}`.toLowerCase(), p.id]));
  let linked = 0;
  for (const r of toCreate) {
    if (!r.introducedBy) continue;
    const introId = byName.get(r.introducedBy.trim().toLowerCase());
    const selfId = createdIds.get(`${r.firstName} ${r.lastName}`.toLowerCase());
    if (!introId || !selfId || introId === selfId) continue;
    await prisma.relationship.updateMany({ where: { personId: selfId, networkOwnerId: user.id }, data: { introducedById: introId } });
    linked++;
  }

  await audit({ tenantId: user.tenantId, actorId: user.id, action: "person.create", entityType: "Person", metadata: { import: true, created: toCreate.length, skipped: rows.length - toCreate.length, linkedIntroducers: linked } });
  return { ok: true, created: toCreate.length, skipped: rows.length - toCreate.length, linkedIntroducers: linked };
}
