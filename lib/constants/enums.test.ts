import { describe, expect, it } from 'vitest';
import {
  AD_LEVELS,
  ERROR_CODES,
  LEAD_STAGE_ORDER,
  LEAD_STAGES,
  PAYMENT_STATUS,
  ROOM_TYPES,
  USER_ROLES,
  type ErrorCodeValue,
  type LeadStage,
} from './enums';

describe('DS-04 enums', () => {
  it('LEAD_STAGES punya 4 stage berurutan dengan label dan warna', () => {
    expect(LEAD_STAGE_ORDER).toEqual(['cold', 'consultation', 'offering', 'closing']);
    expect(LEAD_STAGES.cold.label).toBe('Cold');
    expect(LEAD_STAGES.cold.color).toMatch(/^#[0-9A-F]{6}$/i);
    for (const stage of LEAD_STAGE_ORDER) {
      expect(LEAD_STAGES[stage].label).toBeTruthy();
      expect(LEAD_STAGES[stage].color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('setiap enum punya label bahasa Indonesia yang tidak kosong', () => {
    expect(Object.values(ROOM_TYPES).every((v) => v.label.length > 0)).toBe(true);
    expect(Object.values(PAYMENT_STATUS).every((v) => v.label.length > 0)).toBe(true);
    expect(Object.values(AD_LEVELS).every((v) => v.label.length > 0)).toBe(true);
    expect(Object.values(USER_ROLES).every((v) => v.label.length > 0)).toBe(true);
    expect(ROOM_TYPES.double.label).toBe('Kamar 2');
    expect(PAYMENT_STATUS.lunas.label).toBe('Lunas');
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
