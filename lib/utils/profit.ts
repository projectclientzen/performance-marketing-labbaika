/**
 * Matematika efektivitas iklan untuk tampilan — DS-09b.
 * Helper TS hanya untuk pratinjau & format. Angka dashboard selalu dari server
 * (fungsi `get_dashboard_overview`, migrasi 023). Kalau beda, SQL yang menang.
 * Semua pembagian dengan penyebut nol mengembalikan null.
 *
 * Versi sebelumnya menghitung gross profit dari HPP. HPP dibuang seluruhnya di
 * migrasi 023 (10-AUDIT-FE-BE.md #20) — sistem ini mengukur efektivitas iklan
 * di atas omset, bukan margin. `gross_profit`, `margin_pct`, dan
 * `net_contribution` ikut hilang; `roas` masuk.
 */

export interface ProfitInput {
  revenue: number;
  ad_spend: number;
  closing_count: number;
}

export interface ProfitResult {
  net_revenue: number;
  roi: number | null;
  roas: number | null;
  cpp: number | null;
  breakeven_cpp: number | null;
  ad_cost_ratio: number | null;
}

export function profit(input: ProfitInput): ProfitResult {
  const { revenue, ad_spend, closing_count } = input;

  return {
    net_revenue: revenue - ad_spend,
    roi: ad_spend === 0 ? null : (revenue - ad_spend) / ad_spend,
    roas: ad_spend === 0 ? null : revenue / ad_spend,
    cpp: closing_count === 0 ? null : ad_spend / closing_count,
    // Tanpa HPP, titik impas biaya per closing sama dengan omset per closing:
    // di atas angka itu, satu closing menghabiskan lebih banyak biaya iklan
    // daripada uang yang dibawanya.
    breakeven_cpp: closing_count === 0 ? null : revenue / closing_count,
    ad_cost_ratio: revenue === 0 ? null : ad_spend / revenue,
  };
}

/** Status CPP vs break-even: <70% safe, <100% warning, >=100% over. */
export function cppStatus(
  cpp: number | null,
  breakeven: number | null,
): 'safe' | 'warning' | 'over' {
  if (cpp === null || breakeven === null || breakeven <= 0) return 'safe';
  const ratio = cpp / breakeven;
  if (ratio < 0.7) return 'safe';
  if (ratio < 1) return 'warning';
  return 'over';
}
