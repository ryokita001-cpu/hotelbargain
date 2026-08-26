import { NextRequest, NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { assertCronRequest } from "@/lib/cron-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { recalculateBaselineForHotel } from "@/lib/pricing/baseline";
import { calcDiscountRate, isDeal } from "@/lib/pricing/discount";
import { generateDealReason } from "@/lib/llm/generateReason";

export const maxDuration = 300;

const LOOKAHEAD_DAYS = 14;
const DAY_OF_WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
// 曜日別中央値のサンプル数がこれ未満のうちは「相場」と呼べるほどの根拠が無いため
// deal判定をスキップする。運用開始直後は同じ曜日が1〜2回分のログしか無く、
// たまたま離れた日付同士の自然な価格差を誤って「値下がり」と判定してしまうため。
// fetch-pricesを1日2回・3時間おきに回していれば、1週間程度で十分な数に達する見込み。
const MIN_BASELINE_SAMPLES = 6;

/**
 * 1) 全ホテルの baseline_prices を再計算
 * 2) 直近1〜2週間の最新価格と baseline を比較し、閾値を超えたら deals へ upsert
 * 3) 新規/更新された deal には LLM で理由文を生成
 * 4) 閾値を下回った既存 deal は is_active = false にする
 */
export async function GET(request: NextRequest) {
  const unauthorized = assertCronRequest(request);
  if (unauthorized) return unauthorized;

  const supabase = createServiceRoleSupabaseClient();

  const { data: hotels, error: hotelsError } = await supabase
    .from("hotels")
    .select("id, name, rakuten_hotel_no, booking_url, area_id, areas(name)");
  if (hotelsError) return NextResponse.json({ error: hotelsError.message }, { status: 500 });
  if (!hotels || hotels.length === 0) {
    return NextResponse.json({ message: "no hotels registered yet", deals: 0 });
  }

  let dealCount = 0;
  const errors: string[] = [];

  for (const hotel of hotels) {
    try {
      await recalculateBaselineForHotel(supabase, hotel.id);

      const { data: baselines } = await supabase
        .from("baseline_prices")
        .select("day_of_week, median_price, sample_count")
        .eq("hotel_id", hotel.id);
      const baselineByDow = new Map(
        (baselines ?? []).map((b) => [b.day_of_week, { price: b.median_price, sampleCount: b.sample_count }]),
      );

      for (let i = 1; i <= LOOKAHEAD_DAYS; i++) {
        const checkinDate = format(addDays(new Date(), i), "yyyy-MM-dd");
        const checkoutDate = format(addDays(new Date(), i + 1), "yyyy-MM-dd");
        const dayOfWeek = new Date(checkinDate).getDay();
        const baseline = baselineByDow.get(dayOfWeek);
        if (!baseline || baseline.sampleCount < MIN_BASELINE_SAMPLES) continue;
        const baselinePrice = baseline.price;

        const { data: latestLog } = await supabase
          .from("price_logs")
          .select("price, fetched_at")
          .eq("hotel_id", hotel.id)
          .eq("checkin_date", checkinDate)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!latestLog) continue;

        const currentPrice = latestLog.price;
        const discountRate = calcDiscountRate(baselinePrice, currentPrice);
        const dealIsActive = isDeal(baselinePrice, currentPrice);

        if (dealIsActive && !hotel.booking_url) {
          errors.push(`hotel ${hotel.id}: booking_url未取得のためdeal作成をスキップ（fetch-pricesの実行が先に必要）`);
          continue;
        }

        if (!dealIsActive) {
          await supabase
            .from("deals")
            .update({ is_active: false })
            .eq("hotel_id", hotel.id)
            .eq("checkin_date", checkinDate)
            .eq("checkout_date", checkoutDate);
          continue;
        }

        const { data: recentPrices } = await supabase
          .from("price_logs")
          .select("checkin_date, price")
          .eq("hotel_id", hotel.id)
          .order("fetched_at", { ascending: false })
          .limit(7);

        const areaName = (hotel.areas as unknown as { name: string } | null)?.name ?? "";
        const reason = await generateDealReason({
          hotelName: hotel.name,
          areaName,
          checkinDate,
          daysUntilCheckin: i,
          dayOfWeek: DAY_OF_WEEK_LABELS[dayOfWeek],
          discountRate,
          recentPrices: (recentPrices ?? []).map((p) => ({ date: p.checkin_date, price: p.price })),
        });

        const { error: upsertError } = await supabase.from("deals").upsert(
          {
            hotel_id: hotel.id,
            checkin_date: checkinDate,
            checkout_date: checkoutDate,
            current_price: currentPrice,
            baseline_price: baselinePrice,
            discount_rate: discountRate,
            reason_text: reason,
            reason_model: reason ? "claude-sonnet-5" : null,
            affiliate_url: hotel.booking_url as string,
            is_active: true,
            expires_at: new Date(checkinDate).toISOString(),
          },
          { onConflict: "hotel_id,checkin_date,checkout_date" },
        );
        if (upsertError) throw upsertError;
        dealCount++;
      }
    } catch (err) {
      errors.push(`hotel ${hotel.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ deals: dealCount, errors });
}
