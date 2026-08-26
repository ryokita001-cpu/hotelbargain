import { createReadOnlySupabaseClient } from "@/lib/supabase/read-only";

export type DealListItem = {
  id: number;
  checkinDate: string;
  checkoutDate: string;
  currentPrice: number;
  baselinePrice: number;
  discountRate: number;
  reasonText: string | null;
  affiliateUrl: string;
  hotelName: string;
  imageUrl: string | null;
  areaName: string;
  prefecture: string;
};

export type DealFilters = {
  areaId?: number;
  checkinDate?: string;
  minDiscountRate?: number;
};

export async function getActiveDeals(filters: DealFilters): Promise<DealListItem[]> {
  const supabase = createReadOnlySupabaseClient();

  let query = supabase
    .from("deals")
    .select(
      `id, checkin_date, checkout_date, current_price, baseline_price, discount_rate,
       reason_text, affiliate_url,
       hotels!inner ( name, image_url, area_id, areas ( name, prefecture ) )`,
    )
    .eq("is_active", true)
    .order("discount_rate", { ascending: false });

  if (filters.areaId) {
    query = query.eq("hotels.area_id", filters.areaId);
  }
  if (filters.checkinDate) {
    query = query.eq("checkin_date", filters.checkinDate);
  }
  if (filters.minDiscountRate) {
    query = query.gte("discount_rate", filters.minDiscountRate);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const hotel = row.hotels;
    const area = hotel.areas;
    return {
      id: row.id,
      checkinDate: row.checkin_date,
      checkoutDate: row.checkout_date,
      currentPrice: row.current_price,
      baselinePrice: row.baseline_price,
      discountRate: Number(row.discount_rate),
      reasonText: row.reason_text,
      affiliateUrl: row.affiliate_url,
      hotelName: hotel.name,
      imageUrl: hotel.image_url,
      areaName: area?.name ?? "",
      prefecture: area?.prefecture ?? "",
    };
  });
}

export async function listAreas() {
  const supabase = createReadOnlySupabaseClient();
  const { data, error } = await supabase
    .from("areas")
    .select("id, prefecture, name")
    .order("id");
  if (error) throw error;
  return data ?? [];
}
