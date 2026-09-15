CREATE TABLE public.listings (
  id text PRIMARY KEY,
  sku text NOT NULL DEFAULT '',
  listing_category text NOT NULL DEFAULT '',
  raw text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  styled text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT '',
  updated_at text NOT NULL DEFAULT ''
);

CREATE TABLE public.categories (
  name text PRIMARY KEY
);

CREATE TABLE public.accounts (
  id text PRIMARY KEY,
  platform text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  code text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Active',
  created_at text NOT NULL DEFAULT '',
  updated_at text NOT NULL DEFAULT ''
);

CREATE TABLE public.listing_records (
  id text PRIMARY KEY,
  sku text NOT NULL DEFAULT '',
  account_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  listed_date text NOT NULL DEFAULT '',
  listing_id text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT '',
  updated_at text NOT NULL DEFAULT ''
);

CREATE TABLE public.targets (
  kind text NOT NULL,
  key text NOT NULL,
  value integer NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, key)
);

CREATE TABLE public.prompts (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  file_name text NOT NULL DEFAULT '',
  file_type text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT '',
  updated_at text NOT NULL DEFAULT '',
  history jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_records TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.targets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.listings, public.categories, public.accounts, public.listing_records, public.targets, public.prompts, public.app_settings TO service_role;

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared listings access" ON public.listings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shared categories access" ON public.categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shared accounts access" ON public.accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shared listing_records access" ON public.listing_records FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shared targets access" ON public.targets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shared prompts access" ON public.prompts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shared app_settings access" ON public.app_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.listings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.listing_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.targets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prompts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;