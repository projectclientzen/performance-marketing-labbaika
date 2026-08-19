import { z } from 'zod';
import { ROOM_TYPES } from '../constants/enums';

/**
 * Skema program, departure, dan harga — DS-15.
 * Field mengikuti supabase/migrations/002_program_price_cost.sql (skema
 * yang sudah dites), bukan draft PRD awal.
 *
 * programSchema versi sebelumnya punya `slug` dan `effective_date`/`end_date`
 * yang sebenarnya milik program_prices, bukan programs — tabel `programs`
 * sendiri tidak punya kolom itu sama sekali. Dibetulkan di sini.
 */

export const programSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Nama program wajib'),
  destination: z.string().min(1, 'Destinasi wajib'),
  duration_days: z.number().int().positive('duration_days harus lebih dari 0'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export type Program = z.infer<typeof programSchema>;

export const departureSchema = z
  .object({
    id: z.string().uuid().optional(),
    program_id: z.string().uuid(),
    departure_date: z.string().date('Format tanggal YYYY-MM-DD'),
    return_date: z.string().date('Format tanggal YYYY-MM-DD').optional(),
    quota: z.number().int().positive('quota minimal 1').optional(),
    status: z.enum(['active', 'inactive']).default('active'),
  })
  .superRefine((val, ctx) => {
    if (val.return_date && val.return_date < val.departure_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['return_date'],
        message: 'return_date tidak boleh sebelum departure_date',
      });
    }
  });

export type Departure = z.infer<typeof departureSchema>;

export const priceSchema = z
  .object({
    id: z.string().uuid().optional(),
    program_id: z.string().uuid(),
    departure_id: z.string().uuid().optional(),
    room_type: z.enum(Object.keys(ROOM_TYPES) as [string, ...string[]]),
    price: z.number().int().positive('harga harus lebih dari 0'),
    effective_date: z.string().date('Format tanggal YYYY-MM-DD'),
    end_date: z.string().date('Format tanggal YYYY-MM-DD').optional(),
    status: z.enum(['active', 'inactive']).default('active'),
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

export type Price = z.infer<typeof priceSchema>;

/** Sama bentuk dengan priceSchema, dipakai untuk program_costs (owner-only). */
export const costSchema = z
  .object({
    id: z.string().uuid().optional(),
    program_id: z.string().uuid(),
    departure_id: z.string().uuid().optional(),
    room_type: z.enum(Object.keys(ROOM_TYPES) as [string, ...string[]]),
    cost_price: z.number().int().nonnegative('cost_price tidak boleh negatif'),
    effective_date: z.string().date('Format tanggal YYYY-MM-DD'),
    end_date: z.string().date('Format tanggal YYYY-MM-DD').optional(),
    status: z.enum(['active', 'inactive']).default('active'),
    note: z.string().optional(),
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

export type Cost = z.infer<typeof costSchema>;
