import { createHash, timingSafeEqual } from 'node:crypto';
import type { PurchaseEvent } from '../capi';

export interface DeliveryConfig {
  brandId: string; datasetId: string; apiVersion: string; token: string;
  testCode?: string; maxEventAgeSeconds: number; allowLive: boolean;
}

export function readDeliveryConfig(env: Record<string, string | undefined> = process.env): DeliveryConfig | null {
  const age = Number(env.META_CAPI_MAX_EVENT_AGE_SECONDS);
  if (env.META_CAPI_ROUTE_VERIFIED !== 'true' || !env.META_CAPI_ACCESS_TOKEN ||
    !/^[0-9]+$/.test(env.META_CAPI_DATASET_ID ?? '') ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.META_CAPI_BRAND_ID ?? '') ||
    !/^v[0-9]+\.[0-9]+$/.test(env.META_CAPI_API_VERSION ?? '') ||
    !Number.isSafeInteger(age) || age <= 0) return null;
  return {
    brandId: env.META_CAPI_BRAND_ID!, datasetId: env.META_CAPI_DATASET_ID!,
    apiVersion: env.META_CAPI_API_VERSION!, token: env.META_CAPI_ACCESS_TOKEN,
    testCode: env.META_CAPI_TEST_EVENT_CODE || undefined, maxEventAgeSeconds: age,
    allowLive: env.META_CAPI_ALLOW_LIVE === 'true',
  };
}

export function authorizeWorker(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith('Bearer ')) return false;
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(header.slice(7)), hash(secret));
}

export type DeliveryResult = { status: 'accepted' | 'failed' | 'held'; code: string };

/** One request, no invisible retries. An ambiguous transport result needs reconciliation. */
export async function deliverPurchase(event: PurchaseEvent, mode: 'test' | 'live', config: DeliveryConfig,
  fetcher: typeof fetch = fetch): Promise<DeliveryResult> {
  if (!['test', 'live'].includes(mode) || (mode === 'live' && !config.allowLive) || (mode === 'test' && !config.testCode)) {
    return { status: 'held', code: 'mode_not_configured' };
  }
  try {
    const response = await fetcher(`https://graph.facebook.com/${config.apiVersion}/${config.datasetId}/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
      body: JSON.stringify({ data: [event], ...(mode === 'test' ? { test_event_code: config.testCode } : {}) }),
      signal: AbortSignal.timeout(15000), redirect: 'error',
    });
    const body = await response.json().catch(() => null);
    if (response.ok && body?.events_received === 1 && !body?.error) return { status: 'accepted', code: 'accepted' };
    // Retry only a definite rate-limit rejection, never timeout or unknown 5xx.
    if (response.status === 429 && body?.error) return { status: 'failed', code: 'rate_limited' };
    if (response.status >= 400 && response.status < 500) return { status: 'held', code: 'meta_rejected' };
    return { status: 'held', code: 'delivery_unknown' };
  } catch {
    return { status: 'held', code: 'delivery_unknown' };
  }
}
