import { describe, expect, it } from 'vitest';
import {
  AD_LEVELS,
  ERROR_CODES,
  LEAD_STAGE_CS_LABELS,
  LEAD_STAGE_ORDER,
  LEAD_STAGES,
  PAYMENT_STATUS,
  ROOM_TYPES,
  USER_ROLES,
  type ErrorCodeValue,
  type LeadStage,
} from './enums';

describe('DS-04 enums', () => {
  it('LEAD_STAGES punya 4 stage berurutan dengan label dan warna token prototype', () => {
    expect(LEAD_STAGE_ORDER).toEqual(['cold', 'consultation', 'offering', 'closing']);
    expect(LEAD_STAGES.cold).toEqual({ label: 'Cold', color: '#8FA0AB' });
    expect(LEAD_STAGES.consultation).toEqual({ label: 'Consultation', color: '#2E9AD6' });
    expect(LEAD_STAGES.offering).toEqual({ label: 'Offering', color: '#D6A83C' });
    expect(LEAD_STAGES.closing).toEqual({ label: 'Closing', color: '#1E9E72' });
  });

  it('LEAD_STAGE_CS_LABELS: rekap CS pakai Cold/Hot/Prospek/Closing', () => {
    expect(LEAD_STAGE_CS_LABELS.cold).toBe('Cold');
    expect(LEAD_STAGE_CS_LABELS.consultation).toBe('Hot');
    expect(LEAD_STAGE_CS_LABELS.offering).toBe('Prospek');
    expect(LEAD_STAGE_CS_LABELS.closing).toBe('Closing');
  });

  it('setiap enum punya label yang tidak kosong', () => {
    expect(Object.values(ROOM_TYPES).every((v) => v.label.length > 0)).toBe(true);
    expect(Object.values(PAYMENT_STATUS).every((v) => v.label.length > 0)).toBe(true);
    expect(Object.values(AD_LEVELS).every((v) => v.label.length > 0)).toBe(true);
    expect(Object.values(USER_ROLES).every((v) => v.label.length > 0)).toBe(true);
    expect(ROOM_TYPES.double.label).toBe('Double');
    expect(ROOM_TYPES.quad.label).toBe('Quad');
    expect(PAYMENT_STATUS.paid.label).toBe('Lunas');
  });

  it('ERROR_CODES punya kode unik dan tipe union yang valid', () => {
    const values = Object.values(ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
    const code: ErrorCodeValue = ERROR_CODES.STAGE_UNDERFLOW;
    expect(code).toBe('STAGE_UNDERFLOW');
  });

  it('tipe union LeadStage hanya menerima key yang ada', () => {
    const stage: LeadStage = 'closing';
    expect(LEAD_STAGES[stage].label).toBe('Closing');
  });
});
