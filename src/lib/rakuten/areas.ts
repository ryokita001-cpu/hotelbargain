/**
 * MVP向けの主要エリア一覧。
 *
 * 楽天トラベル地区コードAPI(GetAreaClass, 20140210)を実際に呼び出して得た
 * レスポンス(2026-08-26取得)から、地域が偏らないよう都市を選んで手動で
 * キュレーションしたもの。「都道府県・主要エリア選択」という要件に対して、
 * 全国の地区ツリーを丸ごと持つのではなく、主要都市に絞った方が
 * トップページの選択肢としても扱いやすいと判断した。
 *
 * 対象を増やす場合は GetAreaClass を再度呼び出し、実際に存在するコードを
 * 確認してから追加すること（存在しないコードの組み合わせだと
 * VacantHotelSearch が400 wrong_parameterを返す）。
 */
export type SeedArea = {
  prefecture: string;
  name: string;
  largeClassCode: string;
  middleClassCode: string;
  smallClassCode: string;
  detailClassCode?: string;
};

export const SEED_AREAS: SeedArea[] = [
  {
    prefecture: "東京都",
    name: "東京駅・銀座・秋葉原周辺",
    largeClassCode: "japan",
    middleClassCode: "tokyo",
    smallClassCode: "tokyo",
    detailClassCode: "A",
  },
  {
    prefecture: "東京都",
    name: "渋谷・恵比寿・目黒",
    largeClassCode: "japan",
    middleClassCode: "tokyo",
    smallClassCode: "tokyo",
    detailClassCode: "D",
  },
  {
    prefecture: "神奈川県",
    name: "横浜",
    largeClassCode: "japan",
    middleClassCode: "kanagawa",
    smallClassCode: "yokohama",
  },
  {
    prefecture: "愛知県",
    name: "名古屋駅・伏見・丸の内",
    largeClassCode: "japan",
    middleClassCode: "aichi",
    smallClassCode: "nagoyashi",
    detailClassCode: "A",
  },
  {
    prefecture: "京都府",
    name: "河原町・四条烏丸・二条城",
    largeClassCode: "japan",
    middleClassCode: "kyoto",
    smallClassCode: "shi",
    detailClassCode: "B",
  },
  {
    prefecture: "大阪府",
    name: "大阪駅・梅田",
    largeClassCode: "japan",
    middleClassCode: "osaka",
    smallClassCode: "shi",
    detailClassCode: "B",
  },
  {
    prefecture: "福岡県",
    name: "博多・キャナルシティ",
    largeClassCode: "japan",
    middleClassCode: "hukuoka",
    smallClassCode: "fukuoka",
  },
  {
    prefecture: "北海道",
    name: "すすきの・中島公園",
    largeClassCode: "japan",
    middleClassCode: "hokkaido",
    smallClassCode: "sapporo",
    detailClassCode: "C",
  },
  {
    prefecture: "沖縄県",
    name: "那覇",
    largeClassCode: "japan",
    middleClassCode: "okinawa",
    smallClassCode: "nahashi",
  },
];

export function areaCode(area: SeedArea): string {
  return [area.largeClassCode, area.middleClassCode, area.smallClassCode, area.detailClassCode]
    .filter(Boolean)
    .join("|");
}
