// Lead store: pure operations on the in-memory state plus a JSON file persister.
import { readFile, writeFile, rename, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { defaultSettings, enrichLead, STAGES, RELATIONSHIPS, ACTIVITY_TYPES, CLOSED_STAGES } from "./scoring.js";
import { csvToLeads, findDuplicate } from "./csv.js";

const STAGE_KEYS = STAGES.map((s) => s.key);
const REL_KEYS = RELATIONSHIPS.map((r) => r.key);
const ACTIVITY_KEYS = ACTIVITY_TYPES.map((a) => a.key);

// Logging these activities moves the lead forward to the matching stage (never backwards, never out of a closed stage).
const ACTIVITY_ADVANCES = {
  engaged_post: "warming",
  connection_sent: "requested",
  connection_accepted: "connected",
  message_sent: "messaged",
  replied: "conversation",
  call_booked: "booked",
  call_held: "held",
};

const STRING_FIELDS = { firstName: 80, lastName: 80, profileUrl: 300, email: 200, company: 160, position: 200, headline: 300, location: 160, connectedOn: 40, sector: 80, notes: 5000, source: 80 };

export class ValidationError extends Error {}

const str = (v, max) => (v == null ? "" : String(v).trim().slice(0, max));
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v));

/** Whitelist and clean a lead payload. `partial` allows updates that only touch some fields. */
export function cleanLead(input, { partial = false } = {}) {
  const out = {};
  for (const [k, max] of Object.entries(STRING_FIELDS)) {
    if (k in input || !partial) out[k] = str(input[k], max);
  }
  if ("relationship" in input || !partial) {
    out.relationship = [...new Set((Array.isArray(input.relationship) ? input.relationship : []).filter((r) => REL_KEYS.includes(r)))];
  }
  if ("tags" in input || !partial) {
    out.tags = [...new Set((Array.isArray(input.tags) ? input.tags : String(input.tags ?? "").split(",")).map((t) => str(t, 40)).filter(Boolean))].slice(0, 20);
  }
  if ("stage" in input || !partial) {
    const stage = input.stage ?? "new";
    if (!STAGE_KEYS.includes(stage)) throw new ValidationError(`Unknown stage: ${stage}`);
    out.stage = stage;
  }
  for (const k of ["nextFollowUp", "appointmentAt"]) {
    if (k in input || !partial) {
      if (input[k] && !isDate(input[k])) throw new ValidationError(`${k} must be a date (YYYY-MM-DD)`);
      out[k] = input[k] ? String(input[k]).slice(0, 25) : "";
    }
  }
  if ("sectorManual" in input) out.sectorManual = Boolean(input.sectorManual);
  if (!partial && !out.firstName && !out.lastName) throw new ValidationError("A lead needs a first or last name");
  return out;
}

export function cleanSettings(input) {
  const base = defaultSettings();
  const list = (v, max = 60) => [...new Set((Array.isArray(v) ? v : String(v ?? "").split(",")).map((x) => str(x, max).toLowerCase()).filter(Boolean))];
  const sectors = Array.isArray(input.sectors) ? input.sectors : base.sectors;
  return {
    services: str(input.services, 2000),
    sectors: sectors
      .map((s) => ({ name: str(s.name, 80), priority: [0, 1, 2, 3].includes(Number(s.priority)) ? Number(s.priority) : 0, keywords: list(s.keywords) }))
      .filter((s) => s.name)
      .slice(0, 50),
    targetTitles: list(input.targetTitles),
    targetLocations: list(input.targetLocations),
    excludeKeywords: list(input.excludeKeywords),
    templates: (Array.isArray(input.templates) ? input.templates : base.templates)
      .map((t) => ({ id: str(t.id, 60) || randomUUID(), name: str(t.name, 80), body: str(t.body, 3000) }))
      .filter((t) => t.name && t.body)
      .slice(0, 50),
    weeklyGoals: Object.fromEntries(Object.entries(base.weeklyGoals).map(([k, v]) => {
      const n = Number(input.weeklyGoals?.[k]);
      return [k, Number.isFinite(n) && n >= 0 ? Math.round(n) : v];
    })),
  };
}

export function emptyState() {
  return { version: 1, leads: [], settings: defaultSettings(), followerLog: [] };
}

const now = () => new Date().toISOString();

export function createLead(state, input) {
  const clean = cleanLead(input);
  const existing = findDuplicate(state.leads, clean);
  if (existing) throw new ValidationError(`${existing.firstName} ${existing.lastName} is already in your tracker`);
  const lead = enrichLead({ id: randomUUID(), ...clean, activities: [], createdAt: now(), updatedAt: now(), stageChangedAt: now() }, state.settings);
  state.leads.push(lead);
  return lead;
}

export function updateLead(state, id, input) {
  const i = state.leads.findIndex((l) => l.id === id);
  if (i === -1) return null;
  const patch = cleanLead(input, { partial: true });
  // Editing the sector by hand pins it; clearing it hands detection back to the keywords.
  if ("sector" in input && !("sectorManual" in input)) patch.sectorManual = Boolean(patch.sector);
  const prev = state.leads[i];
  const next = { ...prev, ...patch, updatedAt: now() };
  if (patch.stage && patch.stage !== prev.stage) next.stageChangedAt = now();
  state.leads[i] = enrichLead(next, state.settings);
  return state.leads[i];
}

export function deleteLead(state, id) {
  const before = state.leads.length;
  state.leads = state.leads.filter((l) => l.id !== id);
  return state.leads.length !== before;
}

export function addActivity(state, id, input) {
  const lead = state.leads.find((l) => l.id === id);
  if (!lead) return null;
  if (!ACTIVITY_KEYS.includes(input.type)) throw new ValidationError(`Unknown activity type: ${input.type}`);
  if (input.at && !isDate(input.at)) throw new ValidationError("at must be a date");
  const activity = { id: randomUUID(), type: input.type, note: str(input.note, 2000), at: input.at ? new Date(input.at).toISOString() : now() };
  const patch = { activities: [activity, ...(lead.activities ?? [])].sort((a, b) => b.at.localeCompare(a.at)) };
  const target = ACTIVITY_ADVANCES[input.type];
  if (target && !CLOSED_STAGES.includes(lead.stage) && STAGE_KEYS.indexOf(target) > STAGE_KEYS.indexOf(lead.stage)) {
    patch.stage = target;
    patch.stageChangedAt = now();
  }
  if (input.type === "connection_accepted" && !(lead.relationship ?? []).includes("connection")) patch.relationship = [...(lead.relationship ?? []), "connection"].filter((r) => r !== "prospect");
  if (input.type === "they_engaged" && !(lead.relationship ?? []).includes("engaged")) patch.relationship = [...(lead.relationship ?? []), "engaged"];
  if (input.type === "call_booked" && input.at && !lead.appointmentAt) patch.appointmentAt = String(input.at).slice(0, 10);
  Object.assign(lead, patch, { updatedAt: now() });
  Object.assign(lead, enrichLead(lead, state.settings));
  return lead;
}

export function deleteActivity(state, id, activityId) {
  const lead = state.leads.find((l) => l.id === id);
  if (!lead) return null;
  lead.activities = (lead.activities ?? []).filter((a) => a.id !== activityId);
  Object.assign(lead, enrichLead(lead, state.settings), { updatedAt: now() });
  return lead;
}

/**
 * Merge a CSV into the tracker. Existing people (matched by profile URL, else name + company)
 * gain the new relationship tags and any blank fields; nobody is duplicated or overwritten.
 */
export function importCsv(state, { csv, relationship = [], tags = [], source = "" }) {
  const { leads, skipped, error } = csvToLeads(csv);
  if (error) throw new ValidationError(error);
  const rels = (Array.isArray(relationship) ? relationship : [relationship]).filter((r) => REL_KEYS.includes(r));
  const extraTags = (Array.isArray(tags) ? tags : String(tags).split(",")).map((t) => str(t, 40)).filter(Boolean);
  let created = 0;
  let updated = 0;
  for (const raw of leads) {
    const existing = findDuplicate(state.leads, raw);
    if (existing) {
      const fill = {};
      for (const k of Object.keys(STRING_FIELDS)) if (!existing[k] && raw[k]) fill[k] = raw[k];
      const relationshipU = [...new Set([...(existing.relationship ?? []), ...rels])];
      const tagsU = [...new Set([...(existing.tags ?? []), ...extraTags])];
      Object.assign(existing, cleanLead({ ...fill, relationship: relationshipU, tags: tagsU }, { partial: true }), { updatedAt: now() });
      Object.assign(existing, enrichLead(existing, state.settings));
      updated++;
    } else {
      createLead(state, { ...raw, relationship: rels, tags: extraTags, source: source || "CSV import", stage: rels.includes("connection") ? "connected" : "new" });
      created++;
    }
  }
  return { created, updated, skipped };
}

export function saveSettings(state, input) {
  state.settings = cleanSettings(input);
  state.leads = state.leads.map((l) => enrichLead(l, state.settings));
  return state.settings;
}

export function logFollowers(state, input) {
  if (!isDate(input.date)) throw new ValidationError("date must be YYYY-MM-DD");
  const n = (v) => (v === "" || v == null ? null : Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : null);
  const entry = { date: String(input.date).slice(0, 10), profileFollowers: n(input.profileFollowers), pageFollowers: n(input.pageFollowers), connections: n(input.connections) };
  if (entry.profileFollowers == null && entry.pageFollowers == null && entry.connections == null) throw new ValidationError("Enter at least one count");
  state.followerLog = [...state.followerLog.filter((e) => e.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date));
  return entry;
}

export function deleteFollowerEntry(state, date) {
  state.followerLog = state.followerLog.filter((e) => e.date !== date);
}

export const EXPORT_HEADER = ["First name", "Last name", "Company", "Position", "Sector", "Score", "Tier", "Stage", "Relationship", "Location", "Email", "Profile URL", "Next follow-up", "Appointment", "Tags", "Notes", "Last activity"];

export function exportRows(state) {
  const stageLabel = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));
  return [EXPORT_HEADER, ...state.leads.map((l) => [
    l.firstName, l.lastName, l.company, l.position, l.sector, l.score, l.tier, stageLabel[l.stage] ?? l.stage,
    (l.relationship ?? []).join("; "), l.location, l.email, l.profileUrl, l.nextFollowUp, l.appointmentAt,
    (l.tags ?? []).join("; "), l.notes, l.activities?.[0]?.at?.slice(0, 10) ?? "",
  ])];
}

/** JSON file persistence with atomic writes and a serialised write queue. */
export class FileStore {
  constructor(path) {
    this.path = path;
    this.state = null;
    this.queue = Promise.resolve();
  }

  async load() {
    await mkdir(dirname(this.path), { recursive: true });
    if (existsSync(this.path)) {
      const parsed = JSON.parse(await readFile(this.path, "utf8"));
      this.state = { ...emptyState(), ...parsed, settings: cleanSettings(parsed.settings ?? {}) };
      // Keep a copy of the last good file in case something goes wrong mid-session.
      await copyFile(this.path, this.path + ".bak");
    } else {
      this.state = emptyState();
      await this.flush();
    }
    return this.state;
  }

  replace(next) {
    const settings = cleanSettings(next.settings ?? {});
    this.state = {
      version: 1,
      settings,
      leads: (Array.isArray(next.leads) ? next.leads : []).map((l) => enrichLead({ activities: [], ...l, ...cleanLead(l), id: str(l.id, 60) || randomUUID() }, settings)),
      followerLog: Array.isArray(next.followerLog) ? next.followerLog.filter((e) => isDate(e.date)) : [],
    };
  }

  flush() {
    const data = JSON.stringify(this.state, null, 1);
    this.queue = this.queue.then(async () => {
      const tmp = `${this.path}.${process.pid}.tmp`;
      await writeFile(tmp, data);
      await rename(tmp, this.path);
    });
    return this.queue;
  }
}
