import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const BASELINE_LOOKBACK_DAYS = 60;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/**
 * 「同一ホテル・同一曜日」の過去60日分の観測価格から中央値を算出し、
 * baseline_prices を更新する。中央値を使うのは繁忙期の急騰などの
 * 外れ値に強いため（設計ドキュメント参照）。
 */
export async function recalculateBaselineForHotel(
  supabase: SupabaseClient<Database>,
  hotelId: number,
): Promise<void> {
  const since = new Date();
  since.setDate(since.getDate() - BASELINE_LOOKBACK_DAYS);

  const { data: logs, error } = await supabase
    .from("price_logs")
    .select("checkin_date, price")
    .eq("hotel_id", hotelId)
    .gte("fetched_at", since.toISOString());

  if (error) throw error;
  if (!logs || logs.length === 0) return;

  const pricesByDayOfWeek = new Map<number, number[]>();
  for (const log of logs) {
    const dow = new Date(log.checkin_date).getDay();
    const list = pricesByDayOfWeek.get(dow) ?? [];
    list.push(log.price);
    pricesByDayOfWeek.set(dow, list);
  }

  const rows = Array.from(pricesByDayOfWeek.entries()).map(([dayOfWeek, prices]) => ({
    hotel_id: hotelId,
    day_of_week: dayOfWeek,
    median_price: median(prices),
    sample_count: prices.length,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from("baseline_prices")
    .upsert(rows, { onConflict: "hotel_id,day_of_week" });

  if (upsertError) throw upsertError;
}
