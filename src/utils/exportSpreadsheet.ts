// Client-side spreadsheet export for the performance reports (CI-0010).
//
// Files are written as CSV with a UTF-8 byte-order mark, which Excel opens
// natively with correct encoding for the accented province and indicator names.
// No third-party spreadsheet library is pulled in for this — the reports are
// flat indicator grids, so CSV loses nothing.

const escapeCell = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? '' : String(value);
  // Quote anything Excel would otherwise split or misread
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Turn rows into CSV text (no BOM) — exported for tests and reuse. */
export const toCsv = (rows: (string | number | null | undefined)[][]): string =>
  rows.map(row => row.map(escapeCell).join(',')).join('\r\n');

/**
 * Build the CSV and hand it to the browser as a download. Returns the file name
 * actually used so the caller can report it back to the user.
 */
export const downloadSpreadsheet = (
  fileNameBase: string,
  rows: (string | number | null | undefined)[][]
): string => {
  const fileName = `${fileNameBase.replace(/[^\w.\- ]/g, '_')}.csv`;
  // ﻿ = BOM; without it Excel renders UTF-8 as mojibake on Windows
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Give the download a tick to start before releasing the object URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
};
