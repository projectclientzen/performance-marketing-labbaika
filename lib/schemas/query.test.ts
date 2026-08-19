import { describe, expect, it } from 'vitest';
import { parseDashboardQuery } from './query';

const UUID = '3b241101-e2bb-4255-8caf-4136c566a962';

describe('DS-16 dashboard query schema', () => {
  it('default aman saat kosong', () => {
    const r = parseDashboardQuery({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.attribution).toBe('cash');
      expect(r.data.page).toBe(1);
      expect(r.data.page_size).toBe(20);
      expect(r.data.sources).toEqual([]);
      expect(r.data.campaigns).toEqual([]);
    }
  });

  it('query string diparse (coerce + array)', () => {
    const r = parseDashboardQuery({
      start_date: '2026-08-01',
      end_date: '2026-08-31',
      attribution: 'cohort',
      page: '2',
      page_size: '50',
      sources: UUID,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(2);
      expect(r.data.attribution).toBe('cohort');
      expect(r.data.sources).toEqual([UUID]);
    }
  });

  it('end_date sebelum start_date ditolak', () => {
    const r = parseDashboardQuery({
      start_date: '2026-08-31',
      end_date: '2026-08-01',
    });
    expect(r.success).toBe(false);
  });

  it('attribution invalid / page_size di luar batas ditolak', () => {
    expect(parseDashboardQuery({ attribution: 'x' }).success).toBe(false);
    expect(parseDashboardQuery({ page_size: '101' }).success).toBe(false);
    expect(parseDashboardQuery({ page: '0' }).success).toBe(false);
  });
});
