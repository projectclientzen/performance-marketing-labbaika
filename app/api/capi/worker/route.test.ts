import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn(), from: vi.fn(), rpc: vi.fn(), deliver: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.create }));
vi.mock('@/lib/meta-capi/delivery', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/meta-capi/delivery')>(), deliverPurchase: mocks.deliver,
}));
import { POST } from './route';

const brand = '11111111-1111-4111-8111-111111111111';
const secret = 'test-worker-secret-longer-than-32-characters';
let settings: { mode: string; dataset_id: string };
let row: Record<string, unknown>;
let lease: Record<string, unknown>;
let runs: Record<string, unknown>[];
const event = { id: 'event-id', closing_id: 'booking-1', mode: 'test', value_snapshot: 60000000, event_time: '2026-10-07T00:00:00.123456+00:00', lease_token: 'lease-1' };
const request = () => new Request('http://localhost/api/capi/worker', { method: 'POST', headers: { Authorization: `Bearer ${secret}` } });

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-07T00:01:00Z'));
  for (const [key, value] of Object.entries({ META_CAPI_ROUTE_VERIFIED: 'true', META_CAPI_ACCESS_TOKEN: 'synthetic-token', META_CAPI_DATASET_ID: '123', META_CAPI_BRAND_ID: brand, META_CAPI_API_VERSION: 'v99.0', META_CAPI_MAX_EVENT_AGE_SECONDS: '3600', META_CAPI_TEST_EVENT_CODE: 'TEST_SYNTHETIC', CAPI_WORKER_SECRET: secret, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key' })) vi.stubEnv(key, value);
  settings = { mode: 'test', dataset_id: '123' };
  row = { id: event.closing_id, brand_id: brand, first_name: 'Synthetic', whatsapp_e164: '+6281200000000', pdp_consent: true, pdp_consent_at: '2026-10-07T00:00:20.123456+00:00', payment_status: 'dp', paid_amount: 10000000, total_value: 60000000, pax: 2, price_at_transaction: 30000000, closing_date: '2026-10-07', first_payment_received_at: event.event_time, program_id: 'synthetic-program' };
  lease = { status: 'processing', lease_token: event.lease_token, lease_until: '2026-10-07T00:06:00Z' };
  runs = [];
  mocks.create.mockReturnValue({ from: mocks.from, rpc: mocks.rpc });
  mocks.from.mockImplementation((table: string) => {
    const result = () => Promise.resolve({ data: table === 'capi_settings' ? settings : table === 'closings' ? row : lease, error: null });
    const insert = (value: Record<string, unknown>) => { if (table === 'capi_worker_runs') runs.push(value); return Promise.resolve({ error: null }); };
    const chain = { select: () => chain, eq: () => chain, single: result, maybeSingle: result, insert };
    return chain;
  });
  mocks.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === 'claim_capi_events' ? [event] : true, error: null }));
  mocks.deliver.mockResolvedValue({ status: 'accepted', code: 'accepted' });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('worker boundary and preflight', () => {
  it('rejects unauthenticated callers before creating a privileged client', async () => {
    expect((await POST(new Request('http://localhost/api/capi/worker', { method: 'POST' }))).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('requires verified route configuration before database access', async () => {
    vi.stubEnv('META_CAPI_ROUTE_VERIFIED', 'false');
    expect((await POST(request())).status).toBe(503);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('does not claim or deliver dry-run events', async () => {
    settings.mode = 'dry_run';
    expect(await (await POST(request())).json()).toEqual({ claimed: 0, mode: 'dry_run', run_logged: true });
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.deliver).not.toHaveBeenCalled();
    expect(runs).toEqual([{ brand_id: brand, mode: 'dry_run', outcome: 'idle' }]);
  });
  it('pins dataset and brand before claiming', async () => {
    settings.dataset_id = '999';
    expect((await POST(request())).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('sends full booking value and completes using the same lease', async () => {
    const result = await (await POST(request())).json();
    expect(result).toMatchObject({ accepted: 1, completion_unknown: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith('claim_capi_events', { p_brand_id: brand, p_limit: 3, p_max_age_seconds: 3600 });
    expect(mocks.deliver.mock.calls[0][0]).toMatchObject({ event_id: 'test:integration:labbaika:booking:booking-1:purchase:v1', custom_data: { value: 60000000 } });
    expect(mocks.rpc).toHaveBeenCalledWith('complete_capi_event', { p_id: event.id, p_lease_token: event.lease_token, p_status: 'accepted', p_error: 'accepted' });
    expect(JSON.stringify(result)).not.toContain('booking-1');
  });
  it.each(['revoked', 'expired', 'changed_value', 'consent_revoked'])('holds %s before outbound request', async reason => {
    if (reason === 'revoked') lease.lease_token = 'other';
    if (reason === 'expired') lease.lease_until = '2026-10-07T00:00:30Z';
    if (reason === 'changed_value') row.total_value = 61000000;
    if (reason === 'consent_revoked') row.pdp_consent = false;
    expect(await (await POST(request())).json()).toMatchObject({ held: 1, accepted: 0 });
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it('does not report accepted if the lease completion is uncertain', async () => {
    mocks.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === 'claim_capi_events' ? [event] : false, error: null }));
    expect(await (await POST(request())).json()).toMatchObject({ completion_unknown: 1, accepted: 0 });
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
    expect(runs[0]).toMatchObject({ outcome: 'completion_unknown', completion_unknown: 1 });
  });
  it('logs each run as counts only — no booking, customer or token data', async () => {
    await POST(request());
    expect(runs).toEqual([{ brand_id: brand, mode: 'test', outcome: 'ok', claimed: 1, accepted: 1, failed: 0, held: 0, completion_unknown: 0 }]);
    const logged = JSON.stringify(runs);
    for (const secretish of ['booking-1', '6281200000000', 'synthetic-token', 'Synthetic', event.lease_token]) expect(logged).not.toContain(secretish);
  });
});
