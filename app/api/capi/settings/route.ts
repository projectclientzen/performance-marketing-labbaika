import { z } from 'zod';
import { getAuthedAppUser } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/envelope';
import { readDeliveryConfig } from '@/lib/meta-capi/delivery';

const schema = z.object({ mode: z.enum(['off', 'dry_run', 'test', 'live']), dataset_id: z.string().regex(/^[0-9]+$/).nullable() });
function permitted(role: string | undefined) { return role === 'owner' || role === 'advertiser'; }

export async function GET() {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) return Response.json(fail('UNAUTHORIZED'), { status: 401 });
  if (!appUser?.is_active || !permitted(appUser.role)) return Response.json(fail('FORBIDDEN'), { status: 403 });
  const { data, error } = await supabase.from('capi_settings').select('mode,dataset_id,enabled_at').eq('brand_id', appUser.brand_id).maybeSingle();
  if (error) return Response.json(fail('INTERNAL_ERROR', 'Integrasi belum siap. Periksa migrasi database.'), { status: 503 });
  const config = readDeliveryConfig();
  const ready = Boolean(config && config.brandId === appUser.brand_id && process.env.SUPABASE_SERVICE_ROLE_KEY && (process.env.CAPI_WORKER_SECRET?.length ?? 0) >= 32);
  return Response.json(ok({ settings: data ?? { mode: 'off', dataset_id: null, enabled_at: null },
    readiness: { configured: ready, test: ready && Boolean(config?.testCode), live: ready && Boolean(config?.allowLive) } }));
}

export async function PATCH(request: Request) {
  const { user, appUser, supabase } = await getAuthedAppUser();
  if (!user) return Response.json(fail('UNAUTHORIZED'), { status: 401 });
  if (!appUser?.is_active || !permitted(appUser.role)) return Response.json(fail('FORBIDDEN'), { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(fail('VALIDATION_ERROR', 'Pengaturan tidak valid.'), { status: 422 });
  const { mode, dataset_id } = parsed.data;
  if (mode === 'test' || mode === 'live') {
    const config = readDeliveryConfig();
    if (!config || config.brandId !== appUser.brand_id || config.datasetId !== dataset_id ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.CAPI_WORKER_SECRET?.length ?? 0) < 32 ||
      (mode === 'test' && !config.testCode) || (mode === 'live' && !config.allowLive)) {
      return Response.json(fail('VALIDATION_ERROR', 'Hermes perlu memverifikasi jalur dan konfigurasi server sebelum pengiriman diaktifkan.'), { status: 422 });
    }
  }
  const { error } = await supabase.from('capi_settings').upsert({ brand_id: appUser.brand_id, mode, dataset_id });
  if (error) return Response.json(fail('INTERNAL_ERROR', 'Pengaturan belum tersimpan.'), { status: 500 });
  return Response.json(ok({ saved: true }));
}
