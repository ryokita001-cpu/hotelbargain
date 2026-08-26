import Image from "next/image";
import { PriceGapBadge } from "./PriceGapBadge";
import type { DealListItem } from "@/lib/deals/queries";

export function HotelCard({ deal }: { deal: DealListItem }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="relative h-36 w-full bg-neutral-100">
        {deal.imageUrl && (
          <Image
            src={deal.imageUrl}
            alt={deal.hotelName}
            fill
            sizes="(max-width: 640px) 100vw, 25vw"
            className="object-cover"
          />
        )}
        <PriceGapBadge rate={deal.discountRate} />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="font-mono text-xs text-neutral-500">
          {deal.prefecture} / {deal.areaName}
        </span>
        <h3 className="line-clamp-2 font-bold leading-snug">{deal.hotelName}</h3>
        <span className="text-xs text-neutral-500">
          {deal.checkinDate} 〜 {deal.checkoutDate}
        </span>

        <div className="flex items-baseline gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] text-neutral-400">直近相場</span>
            <span className="text-sm text-neutral-400 line-through">
              ¥{deal.baselinePrice.toLocaleString()}
            </span>
          </div>
          <span className="text-xl font-bold text-teal-700">
            ¥{deal.currentPrice.toLocaleString()}
            <small className="text-xs font-medium text-neutral-500">/泊〜</small>
          </span>
        </div>

        {deal.reasonText && (
          <p className="rounded-lg bg-neutral-50 p-2 text-xs text-neutral-500">
            {deal.reasonText}
            <span className="ml-1 text-neutral-400">(AIによる推測)</span>
          </p>
        )}

        <a
          href={deal.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-auto rounded-lg bg-teal-700 py-2 text-center text-sm font-semibold text-white hover:bg-teal-800"
        >
          楽天トラベルで詳細を見る
        </a>
      </div>
    </article>
  );
}
