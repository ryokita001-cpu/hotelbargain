import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `あなたは宿泊予約ポータルの編集アシスタントです。
与えられたデータのみから、価格が通常より下がっている「もっともらしい推測」を
日本語で1〜2文、80字以内で書いてください。

必ず守ること:
- 断定せず、「〜の可能性があります」「〜と考えられます」等の推測表現を使う
- 与えられたデータにない事実（実際の口コミ・ニュース・天気の詳細等）を捏造しない
- 誇張表現や煽り文句（「今すぐ」「絶対お得」等）は使わない
- 「割引」「セール」「OFF」など、ホテル側が値引きしたと誤解させる表現は使わない
  （比較対象は自社算出の相場推定値であり、実売価格ではないため）
- 出力は指定したJSON形式のみ`;

export type ReasonInput = {
  hotelName: string;
  areaName: string;
  checkinDate: string; // "2026-09-03"
  daysUntilCheckin: number;
  dayOfWeek: string; // "水"
  discountRate: number;
  recentPrices: { date: string; price: number }[];
};

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export async function generateDealReason(input: ReasonInput): Promise<string | null> {
  try {
    const msg = await getClient().messages.create({
      model: MODEL,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `以下のデータから安さの推定理由を生成してください。

ホテル名: ${input.hotelName}
エリア: ${input.areaName}
宿泊日: ${input.checkinDate}（${input.dayOfWeek}曜日、${input.daysUntilCheckin}日後）
相場からの下落率: ${input.discountRate}%
直近の価格推移: ${JSON.stringify(input.recentPrices)}

JSON形式で {"reason": "..."} のみを返してください。`,
        },
      ],
    });

    const block = msg.content[0];
    if (block.type !== "text") return null;
    const parsed = JSON.parse(block.text) as { reason?: string };
    return parsed.reason ?? null;
  } catch (err) {
    // LLM生成は失敗しても deal 自体の登録は妨げない（reason_text は null で許容）
    console.error("generateDealReason failed:", err);
    return null;
  }
}
