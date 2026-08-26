import { NextRequest, NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { assertCronRequest } from "@/lib/cron-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import {
  normalizeRoomPrices,
  rakutenCoordToDegrees,
  searchVacantHotels,
} from "@/lib/rakuten/client";
import type { RakutenHotelEntry, RakutenRoomInfoEntry } from "@/lib/rakuten/types";

function hasRoomInfo(entry: RakutenHotelEntry): entry is { roomInfo: RakutenRoomInfoEntry[] } {
  return "roomInfo" in entry;
}

export const maxDuration = 300;

const LOOKAHEAD_DAYS = 14; // 「直前1〜2週間がメイン」の要件に合わせる
const HOTEL_NO_BATCH_SIZE = 15; // VacantHotelSearch は hotelNo を最大15件まで一度に指定できる

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * 登録済みホテル（hotels テーブル）を対象に、直近1〜2週間分の空室・価格を
 * 楽天トラベル空室検索APIから取得し price_logs に積む。
 *
 * NOTE: 現時点ではエリア単位の巡回（largeClassCode等）はまだ実装しておらず、
 * hotels テーブルに事前登録されたホテルのみが対象。エリア横断の自動発見は
 * 楽天トラベル地区コードAPI(GetAreaClass)でエリアコードを揃えてからの次のステップ。
 */
export async function GET(request: NextRequest) {
  const unauthorized = assertCronRequest(request);
  if (unauthorized) return unauthorized;

  const supabase = createServiceRoleSupabaseClient();

  const { data: hotels, error } = await supabase
    .from("hotels")
    .select("id, rakuten_hotel_no");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!hotels || hotels.length === 0) {
    return NextResponse.json({ message: "no hotels registered yet", inserted: 0 });
  }

  const hotelNoToId = new Map(hotels.map((h) => [h.rakuten_hotel_no, h.id]));
  const checkinDates = Array.from({ length: LOOKAHEAD_DAYS }, (_, i) =>
    format(addDays(new Date(), i + 1), "yyyy-MM-dd"),
  );

  let insertedCount = 0;
  const errors: string[] = [];

  for (const batch of chunk(hotels.map((h) => h.rakuten_hotel_no), HOTEL_NO_BATCH_SIZE)) {
    for (const checkinDate of checkinDates) {
      const checkoutDate = format(addDays(new Date(checkinDate), 1), "yyyy-MM-dd");
      try {
        const res = await searchVacantHotels({
          hotelNo: batch.join(","),
          checkinDate,
          checkoutDate,
        });

        const rows: {
          hotel_id: number;
          checkin_date: string;
          checkout_date: string;
          plan_name: string | null;
          room_type: string | null;
          price: number;
        }[] = [];

        // NOTE: res.hotels は「1ホテル分のエントリ配列」がそのまま要素になった配列の配列
        // （{hotel: [...]} という包み方ではない。実レスポンスで確認済み）。
        for (const hotelEntries of res.hotels) {
          const basicInfoEntry = hotelEntries.find((entry) => "hotelBasicInfo" in entry);
          if (!basicInfoEntry || !("hotelBasicInfo" in basicInfoEntry)) continue;

          const basicInfo = basicInfoEntry.hotelBasicInfo;
          const hotelId = hotelNoToId.get(String(basicInfo.hotelNo));
          if (!hotelId) continue;

          // 画像・予約URL(affiliateId込み)・所在地はレスポンスのたびに最新化しておく。
          // booking_url が無いと detect-deals で deal を起票できない（アフィリエイトURLを
          // 推測で組み立てないため）。
          // 緯度経度は楽天独自の秒単位形式なので rakutenCoordToDegrees で変換してから保存する。
          await supabase
            .from("hotels")
            .update({
              image_url: basicInfo.hotelImageUrl ?? basicInfo.hotelThumbnailUrl ?? null,
              booking_url: basicInfo.hotelInformationUrl ?? null,
              address: [basicInfo.address1, basicInfo.address2].filter(Boolean).join(""),
              latitude: rakutenCoordToDegrees(basicInfo.latitude),
              longitude: rakutenCoordToDegrees(basicInfo.longitude),
            })
            .eq("id", hotelId);

          for (const entry of hotelEntries.filter(hasRoomInfo)) {
            for (const plan of normalizeRoomPrices(entry.roomInfo)) {
              rows.push({
                hotel_id: hotelId,
                checkin_date: checkinDate,
                checkout_date: checkoutDate,
                plan_name: plan.planName,
                room_type: plan.roomClass,
                price: plan.totalPrice,
              });
            }
          }
        }

        if (rows.length > 0) {
          const { error: insertError } = await supabase.from("price_logs").insert(rows);
          if (insertError) throw insertError;
          insertedCount += rows.length;
        }
      } catch (err) {
        errors.push(`${checkinDate}: ${err instanceof Error ? err.message : String(err)}`);
      }

      // 楽天側のレート制限（目安1QPS）を超えないよう間隔を空ける
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }

  return NextResponse.json({ inserted: insertedCount, errors });
}
