/**
 * Matematika profit untuk tampilan — DS-09b.
 * Helper TS hanya untuk pratinjau & format. Angka dashboard selalu dari server
 * (SQL view `v_profitability`, CC-B20). Kalau beda, SQL yang menang.
 * Semua pembagian dengan penyebut nol mengembalikan null.
 */

export interface ProfitInput {
  revenue: number;
  cost_of_sales: number;
  ad_spend: number;
  closing_count: number;
}

export interface ProfitResult {
  gross_profit: number;
  margin_pct: number | null;
  net_contribution: number;
  roi: number | null;
  cpp: number | null;
  breakeven_cpp: number | null;
  ad_cost_ratio: number | null;
}

export function profit(input: ProfitInput): ProfitResult {
  const { revenue, cost_of_sales, ad_spend, closing_count } = input;
  const gross_profit = revenue - cost_of_sales;
  const net_contribution = gross_profit - ad_spend;

  return {
    gross_profit,
    margin_pct: revenue === 0 ? null : gross_profit / revenue,
    net_contribution,
    roi: ad_spend === 0 ? null : net_contribution / ad_spend,
    cpp: closing_count === 0 ? null : ad_spend / closing_count,
    breakeven_cpp: closing_count === 0 ? null : gross_profit / closing_count,
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
