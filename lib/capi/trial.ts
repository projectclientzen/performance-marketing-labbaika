import { z } from 'zod';
import { evaluatePurchaseEligibility, type CapiClosing, type EligibilityOptions } from './index';

const trialClosingSchema = z.object({
  id: z.string(), brand_id: z.string(), first_name: z.string(),
  last_name: z.string().nullable().optional(), whatsapp_e164: z.string(), email: z.string().nullable().optional(),
  pdp_consent: z.boolean(), pdp_consent_at: z.string().nullable().optional(),
  payment_status: z.string(), paid_amount: z.number(), total_value: z.number(), pax: z.number(), price_at_transaction: z.number(),
  is_price_override: z.boolean().optional(), price_note: z.string().nullable().optional(),
  closing_date: z.string(), lead_date: z.string().nullable().optional(), first_payment_received_at: z.string().nullable().optional(), program_id: z.string(),
});

/** Strict RFC-style CSV parser supporting escaped quotes and multiline cells. */
export function parseTrialCsv(input: string): Record<string, unknown>[] {
  const source = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let quoteClosed = false;
  const endCell = () => { row.push(cell); cell = ''; quoteClosed = false; };
  const endRow = () => { endCell(); if (row.some((value) => value !== '')) rows.push(row); row = []; };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; quoteClosed = true; }
      else cell += char;
    } else if (char === ',') endCell();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      endRow();
    } else if (char === '"' && cell === '' && !quoteClosed) quoted = true;
    else {
      if (quoteClosed || char === '"') throw new Error('Invalid CSV quoting');
      cell += char;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (cell || row.length || quoteClosed) endRow();
  if (rows.length === 0) return [];
  const headers = rows.shift()!.map((value) => value.trim());
  if (headers.some((value) => !value) || new Set(headers).size !== headers.length) throw new Error('Invalid CSV headers');
  const numericFields = new Set(['paid_amount', 'total_value', 'pax', 'price_at_transaction']);
  const booleanFields = new Set(['pdp_consent', 'is_price_override']);
  return rows.map((values) => {
    if (values.length !== headers.length) throw new Error('CSV column count mismatch');
    return Object.fromEntries(headers.map((key, index) => {
      const value = values[index];
      if (numericFields.has(key)) return [key, /^-?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : null];
      if (booleanFields.has(key)) {
        const normalized = value.trim().toLowerCase();
        return [key, normalized === 'true' ? true : normalized === 'false' ? false : key === 'is_price_override' && normalized === '' ? undefined : null];
      }
      return [key, value];
    }));
  });
}

export interface TrialSummary {
  mode: 'offline_aggregate_only';
  totalRows: number;
  eligibleRows: number;
  ineligibleRows: number;
  malformedRows: number;
  duplicateRows: number;
  eligibleBookingValueIdr: number;
  eligiblePaidAmountIdr: number;
  reasons: Record<string, number>;
  warnings: Record<string, number>;
}

/** No payloads, identifiers, names, phones, emails, row contents, or API calls. */
export function summarizeTrialRows(rows: unknown[], options: EligibilityOptions = {}): TrialSummary {
  const summary: TrialSummary = { mode: 'offline_aggregate_only', totalRows: rows.length, eligibleRows: 0, ineligibleRows: 0, malformedRows: 0, duplicateRows: 0, eligibleBookingValueIdr: 0, eligiblePaidAmountIdr: 0, reasons: {}, warnings: {} };
  const seen = new Set<string>();
  for (const row of rows) {
    const parsed = trialClosingSchema.safeParse(row);
    if (!parsed.success) { summary.malformedRows++; summary.ineligibleRows++; summary.reasons.INVALID_ROW_SHAPE = (summary.reasons.INVALID_ROW_SHAPE ?? 0) + 1; continue; }
    const closing: CapiClosing = parsed.data;
    const key = JSON.stringify([closing.brand_id, closing.id]);
    if (seen.has(key)) { summary.duplicateRows++; summary.ineligibleRows++; summary.reasons.DUPLICATE_BOOKING_ROW = (summary.reasons.DUPLICATE_BOOKING_ROW ?? 0) + 1; continue; }
    seen.add(key);
    const result = evaluatePurchaseEligibility(closing, options);
    for (const reason of result.reasons) summary.reasons[reason] = (summary.reasons[reason] ?? 0) + 1;
    for (const warning of result.warnings) summary.warnings[warning] = (summary.warnings[warning] ?? 0) + 1;
    if (result.eligible) {
      summary.eligibleRows++;
      summary.eligibleBookingValueIdr += closing.total_value;
      summary.eligiblePaidAmountIdr += closing.paid_amount;
      if (!Number.isSafeInteger(summary.eligibleBookingValueIdr) || !Number.isSafeInteger(summary.eligiblePaidAmountIdr)) throw new Error('Aggregate exceeds safe integer range');
    } else summary.ineligibleRows++;
  }
  return summary;
}
