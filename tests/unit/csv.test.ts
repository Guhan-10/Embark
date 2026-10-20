import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/utils/csv";

type Row = { name: string; note: string | null; count: number; when: Date };
const columns = [
  { header: "Name", value: (r: Row) => r.name },
  { header: "Note", value: (r: Row) => r.note },
  { header: "Count", value: (r: Row) => r.count },
  { header: "When", value: (r: Row) => r.when },
];

describe("toCsv", () => {
  it("writes a BOM, a header row, and CRLF line endings", () => {
    const csv = toCsv([{ name: "Priya", note: null, count: 3, when: new Date("2026-11-02T00:00:00Z") }], columns);
    expect(csv).toBe("﻿Name,Note,Count,When\r\nPriya,,3,2026-11-02\r\n");
  });

  it("quotes commas, quotes, and line breaks", () => {
    const csv = toCsv([{ name: 'Sharma, "Pri"', note: "line1\nline2", count: 0, when: new Date(0) }], columns);
    expect(csv).toContain('"Sharma, ""Pri""","line1\nline2",0,1970-01-01');
  });

  it("neutralises values that spreadsheets would run as formulas", () => {
    for (const evil of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)"]) {
      const csv = toCsv([{ name: evil, note: null, count: -5, when: new Date(0) }], columns);
      expect(csv.split("\r\n")[1].startsWith("'") || csv.split("\r\n")[1].startsWith("\"'")).toBe(true);
      expect(csv).toContain(",-5,"); // real numbers are left alone
    }
  });
});
