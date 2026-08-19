import { z } from 'zod';
import { todayJakarta } from '../utils/date';

/**
 * Skema laporan harian lead — DS-13.
 * Zod memberi pesan ramah lebih awal; constraint database (CC-B04) tetap
 * penjamin terakhir. Jangan ada aturan yang hanya hidup di Zod.
 */

const nonNegativeInt = z.number().int().nonnegative('Harus bilangan bulat non-negatif');

export const leadReportBlockSchema = z
  .object({
    source_id: z.string().uuid('source_id wajib'),
    total_lead: nonNegativeInt,
    cold: nonNegativeInt,
    consultation: nonNegativeInt,
    offering: nonNegativeInt,
  })
  .superRefine((val, ctx) => {
    const sum = val.cold + val.consultation + val.offering;
    if (sum > val.total_lead) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cold'],
        message: 'cold + consultation + offering tidak boleh melebihi total_lead',
      });
    }
  });

export type LeadReportBlock = z.infer<typeof leadReportBlockSchema>;

const dateNotFuture = (val: string, ctx: z.RefinementCtx) => {
  if (val > todayJakarta()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['date'],
      message: 'date tidak boleh di masa depan',
    });
  }
};

/** Umum: date tidak boleh masa depan. */
export const leadReportPayloadSchema = z
  .object({
    date: z.string().date('Format tanggal YYYY-MM-DD'),
    cs_id: z.string().uuid().optional(),
    blocks: z.array(leadReportBlockSchema).min(1, 'Minimal satu block'),
  })
  .superRefine((val, ctx) => dateNotFuture(val.date, ctx));

export type LeadReportPayload = z.infer<typeof leadReportPayloadSchema>;

/** Khusus role CS: date maksimal 7 hari ke belakang. */
export const leadReportPayloadSchemaCS = z
  .object({
    date: z.string().date('Format tanggal YYYY-MM-DD'),
    cs_id: z.string().uuid().optional(),
    blocks: z.array(leadReportBlockSchema).min(1, 'Minimal satu block'),
  })
  .superRefine((val, ctx) => {
    dateNotFuture(val.date, ctx);
    const minDate = new Date();
    minDate.setUTCDate(minDate.getUTCDate() - 7);
    if (val.date < minDate.toISOString().slice(0, 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date'],
        message: 'date tidak boleh lebih dari 7 hari ke belakang',
      });
    }
  });

export type LeadReportPayloadCS = z.infer<typeof leadReportPayloadSchemaCS>;
