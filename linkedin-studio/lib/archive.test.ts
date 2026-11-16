import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { archiveDate, parseConnections, parseShares, readArchive } from "./archive";
import { parseCsv } from "./csv";

const CONNECTIONS = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Jane,Doe,https://www.linkedin.com/in/JaneDoe,,Acme Ltd,"VP, Talent Acquisition",05 Nov 2025
Raj,Patel,https://www.linkedin.com/in/rajp/,raj@x.com,Fintechly,Founder & CEO,14 Jan 2024
`;

describe("csv", () => {
  it("handles quotes, commas and newlines inside fields", () => {
    expect(parseCsv('a,"b, c","line1\nline2"\n1,2,3')).toEqual([["a", "b, c", "line1\nline2"], ["1", "2", "3"]]);
  });
});

describe("archive", () => {
  it("parses dates in LinkedIn's formats", () => {
    expect(archiveDate("05 Nov 2025")).toBe("2025-11-05");
    expect(archiveDate("2025-11-05 10:22:01 UTC")).toBe("2025-11-05");
    expect(archiveDate("11/5/25, 10:22 AM")).toBe("2025-11-05");
  });
  it("skips the notes and reads connections", () => {
    const c = parseConnections(CONNECTIONS);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ name: "Jane Doe", company: "Acme Ltd", position: "VP, Talent Acquisition", connectedOn: "2025-11-05", url: "https://www.linkedin.com/in/janedoe", email: null });
    expect(c[1].email).toBe("raj@x.com");
  });
  it("reads shares", () => {
    const s = parseShares(`Date,ShareLink,ShareCommentary,SharedUrl,MediaUrl,Visibility\n2025-10-01 09:00:00,https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A7390000000000000001,"Line one\n\nLine two",,,MEMBER_NETWORK`);
    expect(s[0]).toMatchObject({ date: "2025-10-01", text: "Line one\n\nLine two" });
  });
  it("reads the ZIP", async () => {
    const zip = new JSZip();
    zip.file("Basic_LinkedInDataExport/Connections.csv", CONNECTIONS);
    zip.file("Basic_LinkedInDataExport/messages.csv", "should,be,ignored");
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    const a = await readArchive("export.zip", buf);
    expect(a.files).toEqual(["Connections.csv"]);
    expect(a.connections).toHaveLength(2);
  });
});
