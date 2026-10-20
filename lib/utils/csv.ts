export type CsvColumn<T> = { header: string; value: (row: T) => string | number | boolean | Date | null | undefined };

/**
 * Cells starting with these could run as formulas when the file is opened in Excel or Sheets
 * (CSV injection), so they're prefixed with a quote.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string | number | boolean | Date | null | undefined) {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Builds a CSV (RFC 4180, CRLF line endings, UTF-8 BOM so Excel reads accents correctly). */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const lines = [columns.map((c) => cell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
