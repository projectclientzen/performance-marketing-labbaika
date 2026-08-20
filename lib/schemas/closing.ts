import { z } from 'zod';
import { normalizePhoneID } from '../utils/phone';

/**
 * Skema closing — DS-14, field mengikuti 02-PRD-v1.3.md §8.1 dan
 * supabase/migrations/004_closings.sql (bentuk tabel yang sudah dites, jadi
 * acuan lebih kuat daripada draft PRD manapun).
 *
 * Versi sebelumnya di file ini punya `lead_id` yang tidak berpadanan dengan
 * kolom manapun di closings, dan kehilangan sebagian besar field wajib
 * (first_name, source_id, previous_stage, program_id, departure_id,
 * room_type) — dibetulkan di sini, bukan patch tempel, karena skema lama
 * tidak bisa dipakai untuk insert closing yang valid sama sekali.
 *
 * Zod memberi pesan ramah; constraint database (CC-B05) penjamin terakhir.
 */

const ROOM_TYPE_VALUES = ['quad', 'triple', 'double', 'child', 'infant'] as const;
const PREVIOUS_STAGE_VALUES = ['cold', 'consultation', 'offering'] as const;
// 'cancelled' sengaja tidak masuk di sini — pembatalan lewat endpoint
// /api/closings/:id/cancel, bukan lewat create/update biasa.
const CREATABLE_PAYMENT_STATUS = ['dp', 'partial', 'lunas', 'refunded'] as const;

// FE selalu mengirim field opsional yang dikosongkan sebagai `""`, bukan
// menghilangkannya dari body (10-AUDIT-FE-BE.md #2/#3). `.optional()` Zod
// hanya menerima field yang benar-benar tidak ada, jadi `""` lolos ke
// `.email()`/FK dan gagal atau (untuk province_id/city_id) menabrak
// constraint FK di DB sebagai 500. Ubah string kosong jadi undefined
// sebelum validasi opsionalnya jalan.
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

export const closingSchema = z
  .object({
    first_name: z.string().min(1, 'Nama depan wajib diisi'),
    last_name: z.preprocess(emptyToUndefined, z.string().optional()),
    whatsapp: z.string().refine((v) => normalizePhoneID(v) !== null, {
      message: 'Nomor WhatsApp Indonesia tidak valid',
    }),
    email: z.preprocess(emptyToUndefined, z.string().email('Email tidak valid').optional()),

    source_id: z.string().uuid('source_id wajib'),
    campaign_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    lead_date: z.string().date('Format tanggal YYYY-MM-DD'),
    previous_stage: z.enum(PREVIOUS_STAGE_VALUES, {
      errorMap: () => ({ message: 'previous_stage harus cold, consultation, atau offering' }),
    }),

    closing_date: z.string().date('Format tanggal YYYY-MM-DD'),
    program_id: z.string().uuid('program_id wajib'),
    departure_id: z.string().uuid('departure_id wajib'),
    room_type: z.enum(ROOM_TYPE_VALUES),
    pax: z.number().int().min(1, 'pax minimal 1'),

    price_at_transaction: z.number().int().nonnegative(),
    total_value: z.number().int().nonnegative(),
    is_price_override: z.boolean().default(false),
    price_note: z.preprocess(emptyToUndefined, z.string().optional()),

    payment_status: z.enum(CREATABLE_PAYMENT_STATUS),
    paid_amount: z.number().int().nonnegative(),

    province_id: z.preprocess(emptyToUndefined, z.string().optional()),
    city_id: z.preprocess(emptyToUndefined, z.string().optional()),
    address: z.string().optional(),

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
