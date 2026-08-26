import { NextRequest, NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { assertCronRequest } from "@/lib/cron-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { rakutenCoordToDegrees, searchVacantHotels } from "@/lib/rakuten/client";
import { areaCode, SEED_AREAS } from "@/lib/rakuten/areas";

export const maxDuration = 300;

const HITS_PER_AREA = 30; // VacantHotelSearch の1ページあたり最大件数

/**
 * SEED_AREAS を巡回し、各エリアの空室検索結果からホテルを発見して
 * areas / hotels テーブルに登録する。価格そのものは fetch-prices が
 * 別途担当するため、ここでは施設のマスタ情報のみを扱う。
 *
 * fetch-prices/detect-deals とは独立したCronとして低頻度（日次程度）で
 * 実行する想定（vercel.json 参照）。
 */
export async function GET(request: NextRequest) {
  const unauthorized = assertCronRequest(request);
  if (unauthorized) return unauthorized;

  const supabase = createServiceRoleSupabaseClient();
  const checkinDate = format(addDays(new Date(), 3), "yyyy-MM-dd");
  const checkoutDate = format(addDays(new Date(), 4), "yyyy-MM-dd");

  let hotelsDiscovered = 0;
  const errors: string[] = [];

  for (const area of SEED_AREAS) {
    try {
      const { data: areaRow, error: areaError } = await supabase
        .from("areas")
        .upsert(
          {
            prefecture: area.prefecture,
            name: area.name,
            rakuten_area_code: areaCode(area),
          },
          { onConflict: "rakuten_area_code" },
        )
        .select("id")
        .single();
      if (areaError) throw areaError;

      const res = await searchVacantHotels({
        largeClassCode: area.largeClassCode,
        middleClassCode: area.middleClassCode,
        smallClassCode: area.smallClassCode,
        detailClassCode: area.detailClassCode,
        checkinDate,
        checkoutDate,
        hits: HITS_PER_AREA,
      });

      const hotelRows = res.hotels.flatMap((hotelEntries) => {
        const basicInfoEntry = hotelEntries.find((entry) => "hotelBasicInfo" in entry);
        if (!basicInfoEntry || !("hotelBasicInfo" in basicInfoEntry)) return [];
        const info = basicInfoEntry.hotelBasicInfo;

        return [
          {
            rakuten_hotel_no: String(info.hotelNo),
            name: info.hotelName,
            area_id: areaRow.id,
            address: [info.address1, info.address2].filter(Boolean).join(""),
            image_url: info.hotelImageUrl ?? info.hotelThumbnailUrl ?? null,
            booking_url: info.hotelInformationUrl ?? null,
            latitude: rakutenCoordToDegrees(info.latitude),
            longitude: rakutenCoordToDegrees(info.longitude),
          },
        ];
      });

      if (hotelRows.length > 0) {
        const { error: upsertError } = await supabase
          .from("hotels")
          .upsert(hotelRows, { onConflict: "rakuten_hotel_no" });
        if (upsertError) throw upsertError;
        hotelsDiscovered += hotelRows.length;
      }
    } catch (err) {
      errors.push(`${area.name}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 楽天側のレート制限（目安1QPS）を超えないよう間隔を空ける
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  return NextResponse.json({ hotelsDiscovered, errors });
}
