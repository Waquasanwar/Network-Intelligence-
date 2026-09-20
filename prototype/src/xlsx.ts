/**
 * Minimal .xlsx reader for the browser: unzips the workbook with DecompressionStream and reads
 * the first worksheet (or one named "Contacts") into rows of strings. No dependency.
 * Handles shared strings, inline strings, numbers and booleans. Dates come back as serial
 * numbers, which is fine for a contact list.
 */

type Entry = { name: string; method: number; compressedSize: number; offset: number };

function readEntries(buf: ArrayBuffer): Entry[] {
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);
  // End of central directory record
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Not a valid .xlsx file");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const entries: Entry[] = [];
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const compressedSize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, method, compressedSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readEntry(buf: ArrayBuffer, e: Entry): Promise<string> {
  const v = new DataView(buf);
  if (v.getUint32(e.offset, true) !== 0x04034b50) throw new Error("Corrupt .xlsx entry");
  const nameLen = v.getUint16(e.offset + 26, true);
  const extraLen = v.getUint16(e.offset + 28, true);
  const start = e.offset + 30 + nameLen + extraLen;
  const data = new Uint8Array(buf, start, e.compressedSize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error("Unsupported compression in .xlsx");
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data]).stream().pipeThrough(ds);
  return await new Response(stream).text();
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) { if (ch >= "A" && ch <= "Z") n = n * 26 + (ch.charCodeAt(0) - 64); else break; }
  return n - 1;
}

const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

export async function readXlsx(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const entries = readEntries(buf);
  const find = (n: string) => entries.find((e) => e.name === n);
  const wbEntry = find("xl/workbook.xml");
  if (!wbEntry) throw new Error("Not a valid .xlsx file");
  const workbookXml = await readEntry(buf, wbEntry);
  const relsXml = find("xl/_rels/workbook.xml.rels") ? await readEntry(buf, find("xl/_rels/workbook.xml.rels")!) : "";
  // Prefer a sheet called Contacts, else the first sheet.
  const sheets = [...workbookXml.matchAll(/<sheet [^>]*name="([^"]*)"[^>]*r:id="([^"]*)"/g)].map((m) => ({ name: unescape(m[1]), rid: m[2] }));
  const chosen = sheets.find((s) => /contacts|people|network/i.test(s.name)) ?? sheets[0];
  if (!chosen) throw new Error("The workbook has no sheets");
  const rel = relsXml.match(new RegExp(`<Relationship [^>]*Id="${chosen.rid}"[^>]*Target="([^"]*)"`)) ?? relsXml.match(new RegExp(`<Relationship [^>]*Target="([^"]*)"[^>]*Id="${chosen.rid}"`));
  let target = rel ? rel[1] : "worksheets/sheet1.xml";
  target = target.startsWith("/") ? target.slice(1) : target.startsWith("xl/") ? target : `xl/${target}`;
  const sheetEntry = find(target) ?? entries.find((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name));
  if (!sheetEntry) throw new Error("Could not find the worksheet inside the file");
  const sheetXml = await readEntry(buf, sheetEntry);
  const ssEntry = find("xl/sharedStrings.xml");
  const shared: string[] = [];
  if (ssEntry) {
    const ss = await readEntry(buf, ssEntry);
    for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(unescape([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  }
  const rows: string[][] = [];
  for (const rm of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1]; const inner = cm[2] ?? "";
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1] ?? "";
      const t = /t="([^"]*)"/.exec(attrs)?.[1];
      let val = "";
      if (t === "s") { const idx = Number(/<v>([^<]*)<\/v>/.exec(inner)?.[1] ?? -1); val = shared[idx] ?? ""; }
      else if (t === "inlineStr") val = unescape([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
      else if (t === "b") val = /<v>1<\/v>/.test(inner) ? "Yes" : "No";
      else val = unescape(/<v>([^<]*)<\/v>/.exec(inner)?.[1] ?? "");
      const ci = ref ? colIndex(ref) : row.length;
      while (row.length < ci) row.push("");
      row[ci] = val.trim();
    }
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v !== ""));
}
