import { z } from 'zod';
import { ROOM_TYPES } from '../constants/enums';

/**
 * Skema program, departure, dan harga — DS-15.
 * Field final mengikuti 02-PRD (verifikasi versi sebelum rilis).
 */

export const programSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, 'Nama program wajib'),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'Slug hanya huruf kecil, angka, dan dash'),
    description: z.string().optional(),
    status: z.enum(['active', 'inactive']).default('active'),
    effective_date: z.string().date('Format tanggal YYYY-MM-DD'),
    end_date: z.string().date('Format tanggal YYYY-MM-DD').optional(),
  })
  .superRefine((val, ctx) => {
    if (val.end_date && val.end_date <= val.effective_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end_date'],
        message: 'end_date harus setelah effective_date',
      });
    }
  });

export type Program = z.infer<typeof programSchema>;

export const departureSchema = z.object({
  id: z.string().uuid().optional(),
  program_id: z.string().uuid(),
  departure_date: z.string().date('Format tanggal YYYY-MM-DD'),
  quota: z.number().int().positive('quota minimal 1'),
  status: z.enum(['open', 'full', 'closed']).default('open'),
});

export type Departure = z.infer<typeof departureSchema>;

export const priceSchema = z.object({
  id: z.string().uuid().optional(),
  program_id: z.string().uuid(),
  departure_id: z.string().uuid().optional(),
  room_type: z.enum(Object.keys(ROOM_TYPES) as [string, ...string[]]),
  price: z.number().int().positive('harga harus lebih dari 0'),
});

export type Price = z.infer<typeof priceSchema>;
