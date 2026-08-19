import { z } from 'zod';

/**
 * Skema query dashboard — DS-16. Parsing & validasi query string.
 * Default aman: attribution cash, page 1, page_size 20, tanpa filter.
 */

const uuidArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v === undefined) return [];
    return (Array.isArray(v) ? v : [v]).filter(Boolean);
  })
  .pipe(z.array(z.string().uuid('ID tidak valid')));

export const dashboardQuerySchema = z
  .object({
    start_date: z.string().date('Format tanggal YYYY-MM-DD').optional(),
    end_date: z.string().date('Format tanggal YYYY-MM-DD').optional(),
    attribution: z.enum(['cash', 'cohort']).default('cash'),
    sources: uuidArray,
    campaigns: uuidArray,
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
  })
  .superRefine((val, ctx) => {
    if (val.start_date && val.end_date && val.end_date < val.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end_date'],
        message: 'end_date tidak boleh sebelum start_date',
      });
    }
  });

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/** Sediakan default yang aman untuk dipakai di server. */
export function parseDashboardQuery(input: unknown) {
  return dashboardQuerySchema.safeParse(input);
}
