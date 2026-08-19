/**
 * Penulis CSV — DS-11. Escaping standar RFC 4180, CRLF, BOM opsional,
 * plus generator untuk streaming baris.
 */

function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Header + baris → string CSV (CRLF). */
export function toCSV(
  headers: string[],
  rows: unknown[][],
  options: { bom?: boolean } = {},
): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  return (options.bom ? '\uFEFF' : '') + lines.join('\r\n');
}

/** Generator streaming: yield baris CSV satu per satu (tanpa header). */
export function* csvRowGenerator(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
  options: { bom?: boolean } = {},
): Generator<string> {
  if (options.bom) yield '\uFEFF';
  yield headers.map(escapeCell).join(',');
  for (let i = 0; i < rows.length; i++) {
    yield rows[i].map(escapeCell).join(',');
  }
}

/** Gabungkan hasil generator jadi satu string CSV. */
export function csvFromGenerator(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
  options: { bom?: boolean } = {},
): string {
  return Array.from(csvRowGenerator(headers, rows, options)).join('\r\n');
}
