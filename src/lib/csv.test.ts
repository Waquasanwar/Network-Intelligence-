import { describe, it, expect } from "vitest";
import { parseCsv, mapHeaders, templateCsv } from "./csv";

describe("parseCsv", () => {
  it("handles quotes, embedded commas, CRLF and tabs", () => {
    const rows = parseCsv('first_name,last_name,notes\r\n"Sarah","Okonkwo","Best in recovery, prefers a call"\r\nBen\tHughes\t""\n');
    expect(rows[0]).toEqual(["first_name", "last_name", "notes"]);
    expect(rows[1]).toEqual(["Sarah", "Okonkwo", "Best in recovery, prefers a call"]);
    expect(rows[2]).toEqual(["Ben", "Hughes", ""]);
  });
  it("unescapes doubled quotes and strips a BOM", () => {
    expect(parseCsv('﻿a,b\n"say ""hi""",2')[1]).toEqual(['say "hi"', "2"]);
  });
});

describe("mapHeaders", () => {
  it("maps template headers, spreadsheet-style labels and aliases", () => {
    const { map, unknown } = mapHeaders(["First Name", "Surname", "E-mail", "Job Title", "Skills", "Referred by", "Favourite colour"]);
    expect(map.first_name).toBe(0);
    expect(map.last_name).toBe(1);
    expect(map.email).toBe(2);
    expect(map.role).toBe(3);
    expect(map.capabilities).toBe(4);
    expect(map.introduced_by).toBe(5);
    expect(unknown).toEqual(["Favourite colour"]);
  });
});

describe("templateCsv", () => {
  it("round-trips through the parser with the expected header", () => {
    const rows = parseCsv(templateCsv());
    expect(rows[0][0]).toBe("first_name");
    expect(rows[1][0]).toBe("Sarah");
    expect(mapHeaders(rows[0]).unknown).toEqual([]);
  });
});
