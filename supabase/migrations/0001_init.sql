create table areas (
  id                 serial primary key,
  prefecture         text not null,
  name               text not null,             -- 例: "京都市", "熱海"
  rakuten_area_code  text not null unique,
  created_at         timestamptz not null default now()
);

create table hotels (
  id                bigserial primary key,
  rakuten_hotel_no  text not null unique,
  name              text not null,
  area_id           int not null references areas(id),
  address           text,
  image_url         text,
  booking_url       text,             -- 楽天レスポンスの hotelInformationUrl（affiliateId込み）
  latitude          numeric(9,6),
  longitude         numeric(9,6),
  created_at        timestamptz not null default now()
);
create index on hotels (area_id);

create table price_logs (
  id            bigserial primary key,
  hotel_id      bigint not null references hotels(id),
  checkin_date  date not null,
  checkout_date date not null,
  plan_name     text,
  room_type     text,
  price         integer not null,          -- 一泊あたり・税込想定
  fetched_at    timestamptz not null default now()
);
create index on price_logs (hotel_id, checkin_date, fetched_at desc);

create table baseline_prices (
  hotel_id      bigint not null references hotels(id),
  day_of_week   smallint not null,         -- 0=日 ... 6=土
  median_price  integer not null,
  sample_count  integer not null,
  updated_at    timestamptz not null default now(),
  primary key (hotel_id, day_of_week)
);

create table deals (
  id              bigserial primary key,
  hotel_id        bigint not null references hotels(id),
  checkin_date    date not null,
  checkout_date   date not null,
  current_price   integer not null,
  baseline_price  integer not null,        -- 自社算出の相場推定値。実売価格ではない
  discount_rate   numeric(5,2) not null,   -- 例: 43.50 (%) ※UI表示は「割引」ではなく「相場比」の文言で統一
  reason_text     text,                     -- LLM生成の「安さの推定理由」（推測であることが伝わる文言のみ）
  reason_model    text,                     -- 生成に使ったモデル名（監査用）
  affiliate_url   text not null,
  is_active       boolean not null default true,
  detected_at     timestamptz not null default now(),
  expires_at      timestamptz not null,     -- checkin_date を過ぎたら自動失効
  unique (hotel_id, checkin_date, checkout_date)
);
create index on deals (is_active, discount_rate desc);
create index on deals (hotel_id, checkin_date);

-- 閲覧側は anon key で deals/hotels/areas を読み取り専用で参照する。
-- 書き込みは service_role（Cron/バッチ）のみが行うため、anon には INSERT/UPDATE/DELETE を許可しない。
alter table areas enable row level security;
alter table hotels enable row level security;
alter table deals enable row level security;

create policy "areas are publicly readable" on areas for select using (true);
create policy "hotels are publicly readable" on hotels for select using (true);
create policy "active deals are publicly readable" on deals for select using (is_active);
