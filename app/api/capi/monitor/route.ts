import { getAuthedAppUser } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/envelope';

/** Coverage (bookings since activation that never entered the queue) and recent worker runs. Aggregates only. */
export async function GET() {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) return Response.json(fail('UNAUTHORIZED'), { status: 401 });
  if (!appUser?.is_active || !['owner', 'advertiser'].includes(appUser.role)) return Response.json(fail('FORBIDDEN'), { status: 403 });
  const [coverage, runs] = await Promise.all([
    supabase.rpc('capi_coverage', { p_brand_id: appUser.brand_id }),
    supabase.from('capi_worker_runs').select('mode,outcome,claimed,accepted,failed,held,completion_unknown,created_at')
      .eq('brand_id', appUser.brand_id).order('created_at', { ascending: false }).limit(10),
  ]);
  if (coverage.error || runs.error) return Response.json(fail('INTERNAL_ERROR', 'Monitor integrasi belum tersedia. Periksa migrasi database.'), { status: 503 });
  return Response.json(ok({ coverage: coverage.data ?? [], runs: runs.data ?? [] }));
}
