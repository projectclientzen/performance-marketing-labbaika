import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/supabase/config';
import { buildPurchaseEvent, type CapiClosing } from '@/lib/capi';
import { authorizeWorker, deliverPurchase, readDeliveryConfig } from '@/lib/meta-capi/delivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Machine endpoint only. No cookies, no dashboard-user credential, no raw payload logs. */
export async function POST(request: Request) {
  if (!authorizeWorker(request.headers.get('authorization'), process.env.CAPI_WORKER_SECRET)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const config = readDeliveryConfig();
  if (!config || !process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'not_configured' }, { status: 503 });
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: settings, error: settingsError } = await db.from('capi_settings').select('mode,dataset_id').eq('brand_id', config.brandId).maybeSingle();
  if (settingsError) return Response.json({ error: 'settings_unavailable' }, { status: 503 });
  if (!settings || !['test', 'live'].includes(settings.mode)) return Response.json({ claimed: 0, mode: settings?.mode ?? 'off' });
  if (settings.dataset_id !== config.datasetId || (settings.mode === 'live' && !config.allowLive) || (settings.mode === 'test' && !config.testCode)) return Response.json({ error: 'mode_not_configured' }, { status: 503 });
  const { data: events, error } = await db.rpc('claim_capi_events', { p_brand_id: config.brandId, p_limit: 3, p_max_age_seconds: config.maxEventAgeSeconds });
  if (error) return Response.json({ error: 'queue_unavailable' }, { status: 503 });
  const counts = { claimed: events?.length ?? 0, accepted: 0, failed: 0, held: 0, completion_unknown: 0 };
  for (const event of events ?? []) {
    let outcome: { status: 'accepted' | 'failed' | 'held'; code: string } = { status: 'held', code: 'preflight_ineligible' };
    // Re-read both booking and mode immediately before delivery; never use CS device identifiers.
    const [{ data: row, error: rowError }, { data: active }, { data: leased }] = await Promise.all([
      db.from('closings').select('*').eq('id', event.closing_id).eq('brand_id', config.brandId).single(),
      db.from('capi_settings').select('mode,dataset_id').eq('brand_id', config.brandId).single(),
      db.from('capi_events').select('status,lease_token,lease_until').eq('id', event.id).single(),
    ]);
    if (!rowError && row && active?.mode === event.mode && active?.dataset_id === config.datasetId && leased?.status === 'processing' && leased?.lease_token === event.lease_token &&
      Date.parse(leased.lease_until) > Date.now() && Number(row.total_value) === Number(event.value_snapshot) && Date.parse(row.first_payment_received_at) === Date.parse(event.event_time)) {
      try {
        const payload = buildPurchaseEvent(row as CapiClosing, { maxEventAgeSeconds: config.maxEventAgeSeconds, ...(event.mode === 'test' ? { testPrefix: 'integration' } : {}) });
        outcome = await deliverPurchase(payload, event.mode, config);
      } catch { outcome = { status: 'held', code: 'eligibility_failed' }; }
    }
    const { data: completed, error: completionError } = await db.rpc('complete_capi_event', { p_id: event.id, p_lease_token: event.lease_token, p_status: outcome.status, p_error: outcome.code });
    if (completionError || !completed) counts.completion_unknown++;
    else counts[outcome.status]++;
  }
  return Response.json(counts);
}
