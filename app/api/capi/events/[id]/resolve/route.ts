import { z } from 'zod';
import { getAuthedAppUser } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/envelope';

// Closes a held event after a human checked Meta. No resend: that needs a verified dedup contract.
const schema = z.object({
  decision: z.enum(['confirmed_received', 'confirmed_not_received']),
  note: z.string().trim().min(10).max(500),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) return Response.json(fail('UNAUTHORIZED'), { status: 401 });
  if (!appUser?.is_active || !['owner', 'advertiser'].includes(appUser.role)) return Response.json(fail('FORBIDDEN'), { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json(fail('VALIDATION_ERROR'), { status: 422 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(fail('VALIDATION_ERROR', 'Pilih keputusan dan tulis bukti pemeriksaan (10–500 karakter).'), { status: 422 });
  const { error } = await supabase.rpc('resolve_capi_event', { p_id: id, p_decision: parsed.data.decision, p_note: parsed.data.note });
  if (error) {
    if (error.code === '55000') return Response.json(fail('CONFLICT', 'Event ini tidak sedang tertahan, atau masih dalam proses kirim.'), { status: 409 });
    if (error.code === 'P0002') return Response.json(fail('NOT_FOUND', 'Event tidak ditemukan.'), { status: 404 });
    if (error.code === '42501') return Response.json(fail('FORBIDDEN'), { status: 403 });
    if (error.code === '22023') return Response.json(fail('VALIDATION_ERROR', 'Keputusan atau catatan tidak valid.'), { status: 422 });
    console.error('[api/capi/events/resolve]', error.code);
    return Response.json(fail('INTERNAL_ERROR', 'Rekonsiliasi belum tersimpan.'), { status: 500 });
  }
  return Response.json(ok({ resolved: true }));
}
