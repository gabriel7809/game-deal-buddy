-- Fix security issue: Set search_path for function
DROP FUNCTION IF EXISTS update_game_prices_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_game_prices_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_game_prices_timestamp
BEFORE UPDATE ON public.game_prices
FOR EACH ROW
EXECUTE FUNCTION update_game_prices_updated_at();