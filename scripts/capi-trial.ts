/** Offline only: npx tsx scripts/capi-trial.ts export.json [--now ISO] [--max-age-seconds N] */
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { parseTrialCsv, summarizeTrialRows } from '../lib/capi/trial';

function main() {
  const args = process.argv.slice(2);
  const file = args.shift();
  if (!file || !['.json', '.csv'].includes(extname(file).toLowerCase())) throw new Error('Expected local JSON or CSV export');
  let now: Date | undefined;
  let maxEventAgeSeconds: number | undefined;
  while (args.length) {
    const flag = args.shift();
    const value = args.shift();
    if (flag === '--now' && value && /(?:Z|[+-]\d{2}:\d{2})$/.test(value)) now = new Date(value);
    else if (flag === '--max-age-seconds' && value && /^\d+$/.test(value)) maxEventAgeSeconds = Number(value);
    else throw new Error('Invalid trial argument');
  }
  if ((now && !Number.isFinite(now.getTime())) || (maxEventAgeSeconds !== undefined && (!Number.isSafeInteger(maxEventAgeSeconds) || maxEventAgeSeconds <= 0))) throw new Error('Invalid trial clock or policy');
  if (statSync(file).size > 20 * 1024 * 1024) throw new Error('Trial export exceeds 20 MiB limit');
  const input = readFileSync(file, 'utf8');
  const rows: unknown = extname(file).toLowerCase() === '.csv' ? parseTrialCsv(input) : JSON.parse(input);
  if (!Array.isArray(rows)) throw new Error('JSON must contain an array of closing records');
  process.stdout.write(`${JSON.stringify(summarizeTrialRows(rows, { now, maxEventAgeSeconds }), null, 2)}\n`);
}

try { main(); }
catch {
  // Parsing errors can contain private data or paths: deliberately suppress their text.
  process.stderr.write('Trial gagal: periksa format JSON/CSV, kolom ekspor, tanggal, opsi, dan ukuran file. Tidak ada data yang dikirim.\n');
  process.exitCode = 1;
}
