import { getAuthedAppUser } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/envelope';

export async function GET(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) return Response.json(fail('UNAUTHORIZED'), { status: 401 });
  if (!appUser?.is_active || !['owner', 'advertiser', 'cs'].includes(appUser.role)) return Response.json(fail('FORBIDDEN'), { status: 403 });
  const params = new URL(request.url).searchParams;
  const rawPage = Number(params.get('page') ?? 0);
  const closingId = params.get('closing_id');
  if (closingId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(closingId)) return Response.json(fail('VALIDATION_ERROR'), { status: 422 });
  const page = Number.isSafeInteger(rawPage) && rawPage >= 0 && rawPage < 10000 ? rawPage : 0;
  let query = supabase.from('capi_events')
    .select('id,closing_id,mode,status,value_snapshot,currency,event_time,attempt_count,last_error,accepted_at,created_at', { count: 'exact' })
    .eq('brand_id', appUser.brand_id).order('created_at', { ascending: false }).order('id').range(page * 50, page * 50 + 49);
  if (closingId) query = query.eq('closing_id', closingId);
  const { data, count, error } = await query;
  if (error) return Response.json(fail('INTERNAL_ERROR', 'Riwayat integrasi belum tersedia.'), { status: 503 });
  return Response.json(ok({ events: data, total: count ?? 0, page }));
}
