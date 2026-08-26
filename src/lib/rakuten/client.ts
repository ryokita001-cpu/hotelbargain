import type {
  NormalizedRoomPrice,
  RakutenRoomInfoEntry,
  RakutenVacantHotelSearchResponse,
  VacantHotelSearchParams,
} from "./types";

const VACANT_HOTEL_SEARCH_ENDPOINT =
  "https://openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426";

// 楽天Developersに登録したApplication URL。Refererヘッダーがこれと一致しないと
// 403(REQUEST_CONTEXT_BODY_HTTP_REFERRER_MISSING)になることを実際に確認済み。
const REGISTERED_APPLICATION_URL = "https://hotel-bargain.com";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/**
 * 楽天独自の座標形式（度*3600の秒単位）を標準の10進度に変換する。
 * 例: 128433.61 → 35.676...（東京駅付近の緯度と一致することを実データで確認済み）。
 * 厳密には旧日本測地系のため WGS84 と数百m程度ずれるが、MVPでは許容する。
 */
export function rakutenCoordToDegrees(raw: number): number {
  return raw / 3600;
}

/**
 * 楽天トラベル空室検索API。
 * applicationId / accessKey はどちらもクエリパラメータとして必須
 * （2026年時点のRakuten Web Service認証仕様、実際に404/403で確認済み）。
 */
export async function searchVacantHotels(
  params: VacantHotelSearchParams,
): Promise<RakutenVacantHotelSearchResponse> {
  const applicationId = requireEnv("RAKUTEN_APPLICATION_ID");
  const accessKey = requireEnv("RAKUTEN_ACCESS_KEY");
  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID;

  const query = new URLSearchParams({
    applicationId,
    accessKey,
    format: "json",
    formatVersion: "2",
    checkinDate: params.checkinDate,
    checkoutDate: params.checkoutDate,
    adultNum: String(params.adultNum ?? 1),
    roomNum: String(params.roomNum ?? 1),
  });

  if (affiliateId) query.set("affiliateId", affiliateId);
  if (params.hits) query.set("hits", String(params.hits));
  if (params.page) query.set("page", String(params.page));

  if ("hotelNo" in params) {
    query.set("hotelNo", params.hotelNo);
  } else {
    query.set("largeClassCode", params.largeClassCode);
    if (params.middleClassCode) query.set("middleClassCode", params.middleClassCode);
    if (params.smallClassCode) query.set("smallClassCode", params.smallClassCode);
    if (params.detailClassCode) query.set("detailClassCode", params.detailClassCode);
  }

  const res = await fetch(`${VACANT_HOTEL_SEARCH_ENDPOINT}?${query.toString()}`, {
    cache: "no-store",
    headers: {
      Referer: REGISTERED_APPLICATION_URL,
      Origin: REGISTERED_APPLICATION_URL,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Rakuten VacantHotelSearch failed: ${res.status} ${body}`);
  }

  return res.json();
}

/**
 * roomInfo配列（roomBasicInfoとdailyChargeが交互に並ぶ）を、
 * 「プラン単位の合計金額」のリストに正規化する。
 * 1プランにつき roomBasicInfo が1つ、続けて宿泊日数分の dailyCharge が並ぶ想定。
 */
export function normalizeRoomPrices(roomInfo: RakutenRoomInfoEntry[]): NormalizedRoomPrice[] {
  const results: NormalizedRoomPrice[] = [];
  let current: NormalizedRoomPrice | null = null;

  for (const entry of roomInfo) {
    if ("roomBasicInfo" in entry) {
      current = {
        roomClass: entry.roomBasicInfo.roomClass ?? null,
        planName: entry.roomBasicInfo.planName ?? null,
        totalPrice: 0,
      };
      results.push(current);
    } else if ("dailyCharge" in entry && current) {
      current.totalPrice += entry.dailyCharge.total;
    }
  }

  return results;
}

/**
 * 楽天トラベルの施設詳細ページへのアフィリエイトリンク。
 * hotelBasicInfo.hotelInformationUrl は affiliateId をリクエストに渡していれば
 * 既にアフィリエイトリンク化された状態で返ってくるため、そのまま使えばよい。
 */
export function buildAffiliateUrl(hotelInformationUrl: string): string {
  return hotelInformationUrl;
}
