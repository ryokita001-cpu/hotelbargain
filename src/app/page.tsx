import { listAreas } from "@/lib/deals/queries";

const DISCOUNT_OPTIONS = [
  { value: "25", label: "相場より25%以上安い" },
  { value: "40", label: "相場より40%以上安い" },
  { value: "60", label: "相場より60%以上安い" },
];

export default async function Home() {
  const areas = await listAreas();

  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 1);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 14);
  const toDateInput = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16">
      <p className="font-mono text-xs uppercase tracking-wider text-teal-700">
        hotel-bargain.com
      </p>
      <h1 className="mt-2 text-3xl font-bold text-neutral-900">
        通常より安いホテルを、
        <br />
        エリアと日付で探す
      </h1>
      <p className="mt-3 text-sm text-neutral-500">
        直近の相場と比べて価格が下がっている宿だけを一覧表示します。
      </p>

      <form action="/deals" method="GET" className="mt-8 flex flex-col gap-5">
        <div>
          <label htmlFor="area" className="mb-1.5 block text-sm font-medium text-neutral-700">
            エリア
          </label>
          <select
            id="area"
            name="area"
            defaultValue=""
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
          >
            <option value="">全エリア</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.prefecture} {area.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="checkin" className="mb-1.5 block text-sm font-medium text-neutral-700">
            チェックイン日
          </label>
          <input
            id="checkin"
            name="checkin"
            type="date"
            min={toDateInput(minDate)}
            max={toDateInput(maxDate)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
          />
          <p className="mt-1 text-xs text-neutral-400">未指定の場合は直近1〜2週間すべてが対象です</p>
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-neutral-700">
            割引率フィルター
          </legend>
          <div className="flex flex-col gap-2">
            {DISCOUNT_OPTIONS.map((opt, i) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2.5 text-sm has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50"
              >
                <input
                  type="radio"
                  name="minDiscount"
                  value={opt.value}
                  defaultChecked={i === 0}
                  className="accent-teal-700"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="mt-2 rounded-lg bg-teal-700 py-3 text-sm font-semibold text-white hover:bg-teal-800"
        >
          価格ドロップを探す
        </button>
      </form>
    </main>
  );
}
