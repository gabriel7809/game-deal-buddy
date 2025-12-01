import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StorePrice {
  store: string;
  price: string;
  originalPrice: string;
  discount: number;
  buyUrl: string;
  available: boolean;
  numericPrice: number | null;
  numericOriginalPrice: number | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appid } = await req.json();
    
    if (!appid) {
      return new Response(
        JSON.stringify({ error: 'appid is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check cache first (prices updated in the last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: cachedPrices, error: cacheError } = await supabase
      .from('game_prices')
      .select('*')
      .eq('appid', appid)
      .gte('last_updated', oneHourAgo);

    const availableStores = cachedPrices?.filter(p => p.available && p.numeric_price && p.numeric_price > 0).length || 0;

    // Return cache if we have Steam price and at least one other store
    if (!cacheError && cachedPrices && cachedPrices.length >= 2 && availableStores >= 1) {
      console.log(`Using cached prices for appid ${appid} (${availableStores} stores available)`);
      
      // Map cached prices
      const cachedPricesList = cachedPrices.map(cp => ({
        store: cp.store,
        price: cp.price,
        originalPrice: cp.original_price,
        discount: cp.discount,
        buyUrl: cp.buy_url,
        available: cp.available,
        numericPrice: cp.numeric_price ? parseFloat(cp.numeric_price) : null,
        numericOriginalPrice: cp.numeric_original_price ? parseFloat(cp.numeric_original_price) : null
      }));
      
      // Return only Steam and GOG prices from cache
      const completePrices = cachedPricesList.filter(p => p.store === 'Steam' || p.store === 'GOG');
      
      return new Response(
        JSON.stringify({ prices: completePrices }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching fresh prices for appid ${appid} (cache miss or insufficient data)`);
    const prices: StorePrice[] = [];

    // Get game name from Steam first for searching other stores
    let gameName = '';
    try {
      const steamInfoResponse = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=br&l=pt`);
      const steamInfoData = await steamInfoResponse.json();
      if (steamInfoData[appid]?.success && steamInfoData[appid]?.data?.name) {
        gameName = steamInfoData[appid].data.name;
        console.log(`Game name from Steam: ${gameName}`);
      }
    } catch (error) {
      console.error('Error fetching game name from Steam:', error);
    }

    // Busca preço da Steam (sempre em BRL direto)
    try {
      const steamResponse = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=br&l=pt`);
      const steamData = await steamResponse.json();
      
      if (steamData[appid]?.success && steamData[appid]?.data?.price_overview) {
        const priceData = steamData[appid].data.price_overview;
        const finalPrice = priceData.final / 100;
        const initialPrice = priceData.initial / 100;
        
        prices.push({
          store: 'Steam',
          price: priceData.final_formatted,
          originalPrice: initialPrice > 0 ? `R$ ${initialPrice.toFixed(2)}` : priceData.final_formatted,
          discount: priceData.discount_percent,
          buyUrl: `https://store.steampowered.com/app/${appid}`,
          available: true,
          numericPrice: finalPrice,
          numericOriginalPrice: initialPrice > 0 ? initialPrice : finalPrice
        });
      } else {
        prices.push({
          store: 'Steam',
          price: 'N/A',
          originalPrice: 'N/A',
          discount: 0,
          buyUrl: `https://store.steampowered.com/app/${appid}`,
          available: false,
          numericPrice: null,
          numericOriginalPrice: null
        });
      }
    } catch (error) {
      console.error('Error fetching Steam price:', error);
      prices.push({
        store: 'Steam',
        price: 'N/A',
        originalPrice: 'N/A',
        discount: 0,
        buyUrl: `https://store.steampowered.com/app/${appid}`,
        available: false,
        numericPrice: null,
        numericOriginalPrice: null
      });
    }

    // Mapeia Steam App IDs para GOG Product IDs e slugs
    const steamToGogMap: { [key: string]: { id: string, slug: string } } = {
      '292030': { id: '1207664643', slug: 'the_witcher_3_wild_hunt' },
      '1091500': { id: '1423049311', slug: 'cyberpunk_2077' },
      '1086940': { id: '1456460669', slug: 'baldurs_gate_iii' },
      '435150': { id: '1584823040', slug: 'divinity_original_sin_2' },
      '632470': { id: '1771589310', slug: 'disco_elysium' },
      '413150': { id: '1453375253', slug: 'stardew_valley' },
      '105600': { id: '1207665503', slug: 'terraria' },
      '367520': { id: '1308320804', slug: 'hollow_knight' },
      '646570': { id: '1950754973', slug: 'slay_the_spire' },
      '588650': { id: '1237807960', slug: 'dead_cells' },
      '20900': { id: '1207658924', slug: 'the_witcher' },
    };

    // Fetch GOG prices usando o ID correto do produto
    const gogMapping = steamToGogMap[appid];
    if (gogMapping) {
      try {
        console.log(`Fetching GOG price for product ID: ${gogMapping.id}`);
        
        const priceResponse = await fetch(`https://api.gog.com/products/${gogMapping.id}/prices?countryCode=BR`);
        
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          console.log('GOG price data:', JSON.stringify(priceData));
          
          if (priceData?._embedded?.prices && priceData._embedded.prices.length > 0) {
            const price = priceData._embedded.prices[0];
            const finalPrice = parseFloat(price.finalPrice) / 100; // Price in cents
            const basePrice = parseFloat(price.basePrice) / 100;
            
            // Calcula o desconto corretamente
            let discount = 0;
            if (price.discountPercentage) {
              discount = price.discountPercentage;
            } else if (basePrice > finalPrice) {
              discount = Math.round(((basePrice - finalPrice) / basePrice) * 100);
            }
            
            console.log(`GOG price: R$ ${finalPrice.toFixed(2)} (base: R$ ${basePrice.toFixed(2)}, discount: ${discount}%)`);
            
            prices.push({
              store: 'GOG',
              price: `R$ ${finalPrice.toFixed(2)}`,
              originalPrice: `R$ ${basePrice.toFixed(2)}`,
              discount: discount,
              buyUrl: `https://www.gog.com/game/${gogMapping.slug}`,
              available: true,
              numericPrice: finalPrice,
              numericOriginalPrice: basePrice
            });
          } else {
            console.log('GOG: No price data available');
          }
        } else {
          console.log(`GOG API returned status ${priceResponse.status}`);
        }
      } catch (error) {
        console.error('Error fetching GOG price:', error);
      }
    } else {
      console.log(`No GOG mapping found for Steam appid ${appid}`);
    }

    // Return only Steam and GOG prices (those that were found)
    const finalPrices = prices;

    console.log(`Total prices found: ${finalPrices.length}`);

    // Save only available prices to database (don't cache unavailable prices)
    for (const price of finalPrices) {
      if (price.available && price.numericPrice && price.numericPrice > 0) {
        await supabase
          .from('game_prices')
          .upsert({
            appid,
            store: price.store,
            price: price.price,
            original_price: price.originalPrice,
            discount: price.discount,
            buy_url: price.buyUrl,
            available: price.available,
            numeric_price: price.numericPrice,
            numeric_original_price: price.numericOriginalPrice
          }, {
            onConflict: 'appid,store'
          });
        console.log(`Saved price for ${price.store}: ${price.price}`);
      }
    }

    console.log(`Available prices saved to database for appid ${appid}`);

    return new Response(
      JSON.stringify({ prices: finalPrices }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
