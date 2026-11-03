import { describe, expect, it, vi } from 'vitest';
import { authorizeWorker, deliverPurchase, readDeliveryConfig, type DeliveryConfig } from './delivery';
import type { PurchaseEvent } from '../capi';

const config: DeliveryConfig = { brandId: 'brand', datasetId: '123', apiVersion: 'v99.0', token: 'private-token', testCode: 'TEST-CODE', maxEventAgeSeconds: 86400, allowLive: true };
const event: PurchaseEvent = { event_name: 'Purchase', event_time: 1000, event_id: 'test', action_source: 'chat', user_data: { ph: ['hash'] }, custom_data: { currency: 'IDR', value: 60000000 } };

describe('CAPI delivery gates and outcomes', () => {
  it('configuration fails closed without explicit verified route and age policy', () => {
    expect(readDeliveryConfig({})).toBeNull();
    const env = { META_CAPI_ROUTE_VERIFIED: 'true', META_CAPI_ACCESS_TOKEN: 'token', META_CAPI_DATASET_ID: '123', META_CAPI_BRAND_ID: '00000000-0000-0000-0000-000000000001', META_CAPI_API_VERSION: 'v99.0', META_CAPI_MAX_EVENT_AGE_SECONDS: '86400' };
    expect(readDeliveryConfig(env)?.allowLive).toBe(false);
    expect(readDeliveryConfig({ ...env, META_CAPI_ROUTE_VERIFIED: 'false' })).toBeNull();
    expect(readDeliveryConfig({ ...env, META_CAPI_API_VERSION: '../../' })).toBeNull();
  });
  it('worker secret rejects missing/short/different credentials', () => {
    const secret = 'a'.repeat(40);
    expect(authorizeWorker(`Bearer ${secret}`, secret)).toBe(true);
    expect(authorizeWorker('Bearer bad', secret)).toBe(false);
    expect(authorizeWorker(null, secret)).toBe(false);
    expect(authorizeWorker('Bearer short', 'short')).toBe(false);
  });
  it('does not call network when live disabled or test code missing', async () => {
    const f = vi.fn();
    expect((await deliverPurchase(event, 'live', { ...config, allowLive: false }, f)).status).toBe('held');
    expect((await deliverPurchase(event, 'test', { ...config, testCode: undefined }, f)).status).toBe('held');
    expect(f).not.toHaveBeenCalled();
  });
  it('test includes code, live excludes it, token only in header, no redirects', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ events_received: 1 }) });
    expect((await deliverPurchase(event, 'test', config, f)).status).toBe('accepted');
    expect(JSON.parse(f.mock.calls[0][1].body).test_event_code).toBe('TEST-CODE');
    expect(f.mock.calls[0][0]).not.toContain(config.token);
    expect(f.mock.calls[0][1].redirect).toBe('error');
    await deliverPurchase(event, 'live', config, f);
    expect(JSON.parse(f.mock.calls[1][1].body).test_event_code).toBeUndefined();
  });
  it.each([
    [200, {}, 'held'], [200, { events_received: 0 }, 'held'], [400, { error: { message: 'private' } }, 'held'],
    [429, { error: { message: 'private' } }, 'failed'], [500, { error: {} }, 'held'],
  ])('classifies response %i without leaking raw errors', async (status, body, outcome) => {
    const f = vi.fn().mockResolvedValue({ ok: status < 300, status, json: async () => body });
    const result = await deliverPurchase(event, 'test', config, f);
    expect(result.status).toBe(outcome);
    expect(JSON.stringify(result)).not.toContain('private');
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('holds ambiguous timeout with no silent retry', async () => {
    const f = vi.fn().mockRejectedValue(new Error('secret'));
    expect(await deliverPurchase(event, 'test', config, f)).toEqual({ status: 'held', code: 'delivery_unknown' });
    expect(f).toHaveBeenCalledTimes(1);
  });
});
