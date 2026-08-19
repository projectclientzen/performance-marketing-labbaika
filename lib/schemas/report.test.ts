import { describe, expect, it } from 'vitest';
import {
  leadReportBlockSchema,
  leadReportPayloadSchema,
  leadReportPayloadSchemaCS,
} from './report';
import { todayJakarta } from '../utils/date';

const validBlock = {
  source_id: '3b241101-e2bb-4255-8caf-4136c566a962',
  total_lead: 10,
  cold: 6,
  consultation: 3,
  offering: 1,
};

describe('DS-13 lead report schema', () => {
  it('block valid', () => {
    expect(leadReportBlockSchema.safeParse(validBlock).success).toBe(true);
  });

  it('jumlah stage melebihi total_lead ditolak', () => {
    const r = leadReportBlockSchema.safeParse({ ...validBlock, total_lead: 5 });
    expect(r.success).toBe(false);
  });

  it('angka negatif / pecahan / bukan angka ditolak', () => {
    expect(leadReportBlockSchema.safeParse({ ...validBlock, cold: -1 }).success).toBe(false);
    expect(leadReportBlockSchema.safeParse({ ...validBlock, cold: 1.5 }).success).toBe(false);
    expect(leadReportBlockSchema.safeParse({ ...validBlock, cold: 'x' }).success).toBe(false);
  });

  it('source_id wajib', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { source_id, ...noSource } = validBlock;
    expect(leadReportBlockSchema.safeParse(noSource).success).toBe(false);
  });

  it('payload: date masa depan ditolak', () => {
    const future = '2099-01-01';
    const r = leadReportPayloadSchema.safeParse({ date: future, blocks: [validBlock] });
    expect(r.success).toBe(false);
  });

  it('payload valid hari ini', () => {
    const r = leadReportPayloadSchema.safeParse({
      date: todayJakarta(),
      blocks: [validBlock],
    });
    expect(r.success).toBe(true);
  });

  it('payload CS: lebih dari 7 hari ke belakang ditolak', () => {
    const old = '2020-01-01';
    const r = leadReportPayloadSchemaCS.safeParse({ date: old, blocks: [validBlock] });
    expect(r.success).toBe(false);
  });
});
