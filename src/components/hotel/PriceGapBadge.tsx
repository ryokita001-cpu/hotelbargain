// 「OFF」「割引」は使わない。比較対象は実売価格ではなく自社算出の
// 相場推定値のため、割引訴求にすると有利誤認表示のリスクがある。
export function PriceGapBadge({ rate }: { rate: number }) {
  return (
    <span className="absolute left-2.5 top-2.5 rounded-md bg-amber-400 px-2.5 py-1 text-xs font-semibold text-amber-950 shadow">
      相場より{Math.round(rate)}%安い
    </span>
  );
}
