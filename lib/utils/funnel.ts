/**
 * Matematika funnel untuk tampilan — DS-10.
 * Helper TS hanya untuk pratinjau langsung di form CS. Angka dashboard selalu
 * dari server (SQL view, CC-B20). Semua pembagian penyebut nol → null.
 */

export interface FunnelInput {
  total_lead: number;
  cold: number;
  consultation: number;
  offering: number;
  closing: number;
}

export interface FunnelStage {
  count: number;
  /** Proporsi terhadap total lead. null saat total 0. */
  rate_of_total: number | null;
  /** Konversi dari stage sebelumnya. null untuk stage pertama / penyebut 0. */
  rate_of_previous: number | null;
}

export interface FunnelResult {
  total_lead: number;
  stages: {
    cold: FunnelStage;
    consultation: FunnelStage;
    offering: FunnelStage;
    closing: FunnelStage;
  };
  /** closing / total_lead. null saat total 0. */
  overall_conversion: number | null;
}

function stage(
  count: number,
  total: number,
  previous: number | null,
): FunnelStage {
  return {
    count,
    rate_of_total: total === 0 ? null : count / total,
    rate_of_previous: previous === null || previous === 0 ? null : count / previous,
  };
}

export function funnel(input: FunnelInput): FunnelResult {
  const { total_lead, cold, consultation, offering, closing } = input;
  return {
    total_lead,
    stages: {
      cold: stage(cold, total_lead, null),
      consultation: stage(consultation, total_lead, cold),
      offering: stage(offering, total_lead, consultation),
      closing: stage(closing, total_lead, offering),
    },
    overall_conversion: total_lead === 0 ? null : closing / total_lead,
  };
}
