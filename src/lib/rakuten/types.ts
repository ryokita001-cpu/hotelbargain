// 2026-08-26 に実際のAPIレスポンス(formatVersion=2)で確認済みの構造。
// 楽天ウェブサービスの公式ドキュメントには価格フィールドの具体名が載っておらず、
// 実際に叩いて確認した内容をそのまま型に反映している。

export type RakutenHotelBasicInfo = {
  hotelNo: number;
  hotelName: string;
  hotelInformationUrl: string; // affiliateId込みの詳細ページURL。これをそのまま affiliate_url として使う
  hotelMinCharge: number;
  // NOTE: 標準の10進度ではなく、楽天独自の「秒単位（度*3600）」形式で返ってくる。
  // 例: 128433.61 / 3600 ≈ 35.676（東京駅付近の緯度）。DBに保存する際は必ず3600で割ること。
  latitude: number;
  longitude: number;
  hotelImageUrl: string | null;
  hotelThumbnailUrl: string | null;
  address1: string;
  address2: string;
};

export type RakutenRoomBasicInfo = {
  roomClass?: string;
  roomName?: string;
  planId?: number;
  planName?: string;
};

export type RakutenDailyCharge = {
  stayDate: string; // "2026-09-02"
  rakutenCharge: number;
  total: number; // 税込・当日分の合計金額
  chargeFlag: number;
};

// roomInfo 配下は roomBasicInfo と dailyCharge が別要素として並ぶ
// （1プランにつき roomBasicInfo が1つ、宿泊日数分の dailyCharge が続く）。
export type RakutenRoomInfoEntry =
  | { roomBasicInfo: RakutenRoomBasicInfo }
  | { dailyCharge: RakutenDailyCharge };

export type RakutenHotelEntry =
  | { hotelBasicInfo: RakutenHotelBasicInfo }
  | { roomInfo: RakutenRoomInfoEntry[] };

export type RakutenVacantHotelSearchResponse = {
  pagingInfo: {
    recordCount: number;
    pageCount: number;
    page: number;
    first: number;
    last: number;
  };
  // NOTE: ドキュメント上は `{ hotel: [...] }[]` のような形を想定しがちだが、
  // 実際は「1ホテル分のエントリ配列」がそのまま要素になった配列の配列で返る。
  hotels: RakutenHotelEntry[][];
};

export type VacantHotelSearchParams = {
  checkinDate: string; // "2026-09-03"
  checkoutDate: string;
  adultNum?: number;
  roomNum?: number;
  hits?: number;
  page?: number;
} & (
  | { hotelNo: string } // カンマ区切りで最大15件
  | {
      largeClassCode: string;
      middleClassCode?: string;
      smallClassCode?: string;
      detailClassCode?: string;
    }
);

/** 1プラン分の正規化済みレコード（roomBasicInfo + 対応するdailyChargeをまとめたもの） */
export type NormalizedRoomPrice = {
  roomClass: string | null;
  planName: string | null;
  /** 宿泊全泊分の合計（一泊のみの検索なら一泊あたりの価格と同義） */
  totalPrice: number;
};
