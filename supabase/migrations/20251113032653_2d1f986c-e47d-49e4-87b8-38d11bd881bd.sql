-- Create table to store game prices from different stores
CREATE TABLE IF NOT EXISTS public.game_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appid TEXT NOT NULL,
  store TEXT NOT NULL,
  price TEXT NOT NULL,
  original_price TEXT NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  buy_url TEXT NOT NULL,
  available BOOLEAN NOT NULL DEFAULT true,
  numeric_price NUMERIC,
  numeric_original_price NUMERIC,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(appid, store)
);

-- Enable RLS
ALTER TABLE public.game_prices ENABLE ROW LEVEL SECURITY;

-- Policy to allow anyone to read game prices (public data)
CREATE POLICY "Anyone can view game prices"
ON public.game_prices
FOR SELECT
USING (true);

-- Policy to allow service role to insert/update prices
CREATE POLICY "Service role can manage prices"
ON public.game_prices
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_game_prices_appid ON public.game_prices(appid);
CREATE INDEX idx_game_prices_store ON public.game_prices(store);
CREATE INDEX idx_game_prices_last_updated ON public.game_prices(last_updated);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_game_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_game_prices_timestamp
BEFORE UPDATE ON public.game_prices
FOR EACH ROW
EXECUTE FUNCTION update_game_prices_updated_at();