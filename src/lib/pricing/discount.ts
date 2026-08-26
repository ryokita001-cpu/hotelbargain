export const DEAL_THRESHOLD_PERCENT = 25;

export function calcDiscountRate(baseline: number, current: number): number {
  if (baseline <= 0) return 0;
  const rate = ((baseline - current) / baseline) * 100;
  return Math.max(0, Math.round(rate * 100) / 100);
}

export function isDeal(baseline: number, current: number): boolean {
  return calcDiscountRate(baseline, current) >= DEAL_THRESHOLD_PERCENT;
}
