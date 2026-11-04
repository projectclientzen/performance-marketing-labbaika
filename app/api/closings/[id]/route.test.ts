import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ getAuthedAppUser: m.session }));
import { PATCH } from './route';
beforeEach(() => {
  vi.resetAllMocks();
  m.from.mockReturnValue({ update: m.update });
  m.update.mockReturnValue({ eq: m.eq });
  m.eq.mockResolvedValue({ error: null, count: 1 });
});
describe('closing payment edit through role-specific tables', () => {
  it.each(['cs', 'owner'])('preserves timestamp precision and valid update shape for %s', async role => {
    m.session.mockResolvedValue({ user: { id: 'user' }, appUser: { id: 'user', role }, supabase: { from: m.from } });
    const timestamp = '2026-10-07T00:00:00.123456+00:00';
    const response = await PATCH(new Request('http://localhost/api/closings/booking', { method: 'PATCH', body: JSON.stringify({ paid_amount: 20000000, payment_status: 'partial', first_payment_received_at: timestamp }) }), { params: Promise.resolve({ id: 'booking' }) });
    expect(response.status).toBe(200);
    expect(m.from).toHaveBeenCalledWith(role === 'cs' ? 'v_closings_cs' : 'closings');
    expect(m.update.mock.calls[0][0].first_payment_received_at).toBe(timestamp);
    if (role === 'cs') expect(m.update.mock.calls[0][0]).not.toHaveProperty('updated_by');
    else expect(m.update.mock.calls[0][0].updated_by).toBe('user');
  });
});
