import Link from "next/link";
import { HotelCard } from "@/components/hotel/HotelCard";
import { getActiveDeals, listAreas } from "@/lib/deals/queries";

type SearchParams = {
  area?: string;
  checkin?: string;
  minDiscount?: string;
};

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const areaId = params.area ? Number(params.area) : undefined;
  const minDiscountRate = params.minDiscount ? Number(params.minDiscount) : undefined;

  const [deals, areas] = await Promise.all([
    getActiveDeals({
      areaId,
      checkinDate: params.checkin,
      minDiscountRate,
    }),
    listAreas(),
  ]);

  const selectedArea = areas.find((a) => a.id === areaId);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="text-sm text-teal-700 hover:underline">
        ← 検索条件を変更する
      </Link>

      <h1 className="mt-3 text-2xl font-bold">
        {selectedArea ? `${selectedArea.prefecture} ${selectedArea.name}` : "全エリア"}
        の価格ドロップ
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {params.checkin ? `${params.checkin}チェックイン・` : ""}
        {minDiscountRate ? `相場より${minDiscountRate}%以上安い宿のみ表示中` : "相場より安い宿を表示中"}
      </p>

      {deals.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
          条件に合う価格ドロップは見つかりませんでした。
          <br />
          エリアや日付、割引率のしきい値を変えてお試しください。
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal) => (
            <HotelCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </main>
  );
}
