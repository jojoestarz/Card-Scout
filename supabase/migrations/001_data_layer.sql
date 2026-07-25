-- Data Layer Completion: schema fixes for variations, pricing, search, and fx_rate stub
-- Apply via Supabase SQL editor or: supabase db push (when CLI is configured)

BEGIN;

-- ---------------------------------------------------------------------------
-- Extensions & search indexes (cards)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_cards_name_trgm
  ON cards USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cards_card_id_pattern
  ON cards (card_id);

-- ---------------------------------------------------------------------------
-- variations: extend for printing + external IDs
-- ---------------------------------------------------------------------------
ALTER TABLE variations
  ADD COLUMN IF NOT EXISTS printing TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS justtcg_variant_id TEXT,
  ADD COLUMN IF NOT EXISTS tcgplayer_id TEXT;

-- Backfill printing from legacy version column where present
UPDATE variations
SET printing = COALESCE(NULLIF(version, ''), 'normal')
WHERE printing = 'normal'
  AND version IS NOT NULL
  AND version <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_variations_card_id_printing
  ON variations (card_id, printing);

-- ---------------------------------------------------------------------------
-- pricing: fix typo, reshape for 1 row per variant
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pricing'
      AND column_name = 'last_ updated'
  ) THEN
    ALTER TABLE pricing RENAME COLUMN "last_ updated" TO last_updated;
  END IF;
END $$;

ALTER TABLE pricing
  ADD COLUMN IF NOT EXISTS price_usd NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS price_change_7d NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS avg_price_7d NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS price_history JSONB;

-- Ensure last_updated exists even if typo column was already fixed
ALTER TABLE pricing
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pricing_variation_id_fkey'
  ) THEN
    ALTER TABLE pricing
      ADD CONSTRAINT pricing_variation_id_fkey
      FOREIGN KEY (variation_id) REFERENCES variations (variations_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_variation_id
  ON pricing (variation_id);

-- ---------------------------------------------------------------------------
-- fx_rate stub (Phase 2 portfolio math)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_rate (
  date DATE PRIMARY KEY,
  usd_gbp NUMERIC(10, 6) NOT NULL
);

-- ---------------------------------------------------------------------------
-- RLS: anon read on data tables (writes remain service-key-only)
-- ---------------------------------------------------------------------------
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_rate ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cards' AND policyname = 'anon_read_cards'
  ) THEN
    CREATE POLICY anon_read_cards ON cards FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'variations' AND policyname = 'anon_read_variations'
  ) THEN
    CREATE POLICY anon_read_variations ON variations FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pricing' AND policyname = 'anon_read_pricing'
  ) THEN
    CREATE POLICY anon_read_pricing ON pricing FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fx_rate' AND policyname = 'anon_read_fx_rate'
  ) THEN
    CREATE POLICY anon_read_fx_rate ON fx_rate FOR SELECT TO anon USING (true);
  END IF;
END $$;

COMMIT;
