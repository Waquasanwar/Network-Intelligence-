/**
 * LinkedIn's own data download: Settings & Privacy → Data privacy → Get a copy of your data.
 * We read the ZIP (or single CSVs from it) for:
 *   Connections.csv  your network: name, profile URL, email (if shared), company, position, connected on
 *   Shares.csv       every post you've written: date, link, text
 *   Invitations.csv  invitations sent and received, with messages
 * Messages are deliberately not read.
 */
import { csvObjects } from "./csv";

export interface ArchiveConnection {
  firstName: string;
  lastName: string;
  name: string;
  url: string | null;
  email: string | null;
  company: string;
  position: string;
  connectedOn: string | null; // YYYY-MM-DD
}

export interface ArchiveShare {
  date: string | null;
  link: string | null;
  text: string;
  sharedUrl: string | null;
}

export interface ArchiveInvitation {
  from: string;
  to: string;
  sentAt: string | null;
  message: string;
  direction: "incoming" | "outgoing" | "unknown";
  profileUrl: string | null;
}

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

/** "05 Nov 2025", "2025-11-05 10:22:01 UTC", "11/5/25, 10:22 AM" → "2025-11-05". */
export function archiveDate(v: string | undefined | null): string | null {
  if (!v) return null;
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

export function normaliseProfileUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  const m = u.trim().match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? `https://www.linkedin.com/in/${decodeURIComponent(m[1]).toLowerCase()}` : u.trim() || null;
}

export function parseConnections(text: string): ArchiveConnection[] {
  return csvObjects(text, ["first name", "last name"])
    .map((r) => {
      const firstName = r["first name"] ?? "";
      const lastName = r["last name"] ?? "";
      return {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        url: normaliseProfileUrl(r["url"] || r["profile url"]),
        email: r["email address"] || r["email"] || null,
        company: r["company"] ?? "",
        position: r["position"] || r["title"] || "",
        connectedOn: archiveDate(r["connected on"]),
      };
    })
    .filter((c) => c.name);
}

export function parseShares(text: string): ArchiveShare[] {
  return csvObjects(text, ["date"])
    .map((r) => ({
      date: archiveDate(r["date"]),
      link: r["sharelink"] || r["share link"] || null,
      text: r["sharecommentary"] || r["share commentary"] || r["commentary"] || "",
      sharedUrl: r["sharedurl"] || r["shared url"] || null,
    }))
    .filter((s) => s.text.trim() || s.link);
}

export function parseInvitations(text: string): ArchiveInvitation[] {
  return csvObjects(text, ["from", "to"]).map((r) => {
    const dir = (r["direction"] || "").toLowerCase();
    return {
      from: r["from"] ?? "",
      to: r["to"] ?? "",
      sentAt: archiveDate(r["sent at"]),
      message: r["message"] ?? "",
      direction: dir.includes("incoming") ? "incoming" : dir.includes("outgoing") ? "outgoing" : "unknown",
      profileUrl: normaliseProfileUrl(r["inviterprofileurl"] || r["inviteeprofileurl"] || null),
    };
  });
}

export interface ArchiveContents {
  connections: ArchiveConnection[];
  shares: ArchiveShare[];
  invitations: ArchiveInvitation[];
  files: string[];
}

/** Accepts the full ZIP or any of the individual CSVs. */
export async function readArchive(name: string, buf: ArrayBuffer): Promise<ArchiveContents> {
  const out: ArchiveContents = { connections: [], shares: [], invitations: [], files: [] };
  const take = (file: string, text: string) => {
    const base = file.split("/").pop()!.toLowerCase();
    if (base === "connections.csv") out.connections = parseConnections(text);
    else if (base === "shares.csv") out.shares = parseShares(text);
    else if (base === "invitations.csv") out.invitations = parseInvitations(text);
    else return;
    out.files.push(file.split("/").pop()!);
  };
  if (name.toLowerCase().endsWith(".zip")) {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buf);
    for (const f of Object.values(zip.files)) if (!f.dir && f.name.toLowerCase().endsWith(".csv")) take(f.name, await f.async("string"));
  } else take(name, new TextDecoder().decode(buf));
  if (!out.files.length) throw new Error("No Connections.csv, Shares.csv or Invitations.csv found. Upload LinkedIn's data download ZIP or one of those files.");
  return out;
}
