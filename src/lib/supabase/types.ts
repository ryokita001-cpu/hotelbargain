type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Insert, Relationships extends Relationship[] = [], Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export type Database = {
  public: {
    Tables: {
      areas: Table<
        {
          id: number;
          prefecture: string;
          name: string;
          rakuten_area_code: string;
          created_at: string;
        },
        {
          prefecture: string;
          name: string;
          rakuten_area_code: string;
        }
      >;
      hotels: Table<
        {
          id: number;
          rakuten_hotel_no: string;
          name: string;
          area_id: number;
          address: string | null;
          image_url: string | null;
          booking_url: string | null;
          latitude: number | null;
          longitude: number | null;
          created_at: string;
        },
        {
          rakuten_hotel_no: string;
          name: string;
          area_id: number;
          address?: string | null;
          image_url?: string | null;
          booking_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
        },
        [
          {
            foreignKeyName: "hotels_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
        ]
      >;
      price_logs: Table<
        {
          id: number;
          hotel_id: number;
          checkin_date: string;
          checkout_date: string;
          plan_name: string | null;
          room_type: string | null;
          price: number;
          fetched_at: string;
        },
        {
          hotel_id: number;
          checkin_date: string;
          checkout_date: string;
          plan_name?: string | null;
          room_type?: string | null;
          price: number;
          fetched_at?: string;
        },
        [
          {
            foreignKeyName: "price_logs_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels";
            referencedColumns: ["id"];
          },
        ]
      >;
      baseline_prices: Table<
        {
          hotel_id: number;
          day_of_week: number;
          median_price: number;
          sample_count: number;
          updated_at: string;
        },
        {
          hotel_id: number;
          day_of_week: number;
          median_price: number;
          sample_count: number;
          updated_at?: string;
        },
        [
          {
            foreignKeyName: "baseline_prices_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels";
            referencedColumns: ["id"];
          },
        ]
      >;
      deals: Table<
        {
          id: number;
          hotel_id: number;
          checkin_date: string;
          checkout_date: string;
          current_price: number;
          baseline_price: number;
          discount_rate: number;
          reason_text: string | null;
          reason_model: string | null;
          affiliate_url: string;
          is_active: boolean;
          detected_at: string;
          expires_at: string;
        },
        {
          hotel_id: number;
          checkin_date: string;
          checkout_date: string;
          current_price: number;
          baseline_price: number;
          discount_rate: number;
          reason_text?: string | null;
          reason_model?: string | null;
          affiliate_url: string;
          is_active?: boolean;
          detected_at?: string;
          expires_at: string;
        },
        [
          {
            foreignKeyName: "deals_hotel_id_fkey";
            columns: ["hotel_id"];
            isOneToOne: false;
            referencedRelation: "hotels";
            referencedColumns: ["id"];
          },
        ]
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
