import { z } from 'zod';
import { PAYMENT_STATUS } from '../constants/enums';
import { normalizePhoneID } from '../utils/phone';

/**
 * Skema closing — DS-14. Field mengikuti 02-PRD-v1.1.md §8.1.
 * Zod memberi pesan ramah; constraint database (CC-B05) penjamin terakhir.
 */

export const closingSchema = z
  .object({
    lead_id: z.string().uuid(),
    lead_date: z.string().date('Format tanggal YYYY-MM-DD'),
    closing_date: z.string().date('Format tanggal YYYY-MM-DD'),
    pax: z.number().int().min(1, 'pax minimal 1'),
    total_value: z.number().int().nonnegative(),
    paid_amount: z.number().int().nonnegative(),
    payment_status: z.enum(Object.keys(PAYMENT_STATUS) as [string, ...string[]]),
    whatsapp: z.string().refine((v) => normalizePhoneID(v) !== null, {
      message: 'Nomor WhatsApp Indonesia tidak valid',
    }),
    is_price_override: z.boolean().default(false),
    price_note: z.string().optional(),
    pdp_consent: z.boolean().default(false),
    pdp_consent_at: z.string().datetime().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.closing_date < val.lead_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['closing_date'],
        message: 'closing_date tidak boleh sebelum lead_date',
      });
    }
    if (val.paid_amount > val.total_value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paid_amount'],
        message: 'paid_amount tidak boleh melebihi total_value',
      });
    }
    if (val.is_price_override && !val.price_note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price_note'],
        message: 'price_note wajib diisi saat is_price_override true',
      });
    }
    if (val.pdp_consent && !val.pdp_consent_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pdp_consent_at'],
        message: 'pdp_consent_at wajib diisi saat pdp_consent true',
      });
    }
  });

export type Closing = z.infer<typeof closingSchema>;
