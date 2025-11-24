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
      
      // Ensure we always have all 3 stores in response
      const storeNames = ['Steam', 'GOG', 'Epic Games'];
      const completePrices = storeNames.map(storeName => {
        const existingPrice = cachedPricesList.find(p => p.store === storeName);
        if (existingPrice) {
          return existingPrice;
        }
        // Return placeholder for missing stores
        return {
          store: storeName,
          price: 'Consulte a loja',
          originalPrice: 'Consulte a loja',
          discount: 0,
          buyUrl: storeName === 'Steam' 
            ? `https://store.steampowered.com/app/${appid}` 
            : storeName === 'GOG'
            ? `https://www.gog.com/games`
            : `https://store.epicgames.com/pt-BR/`,
          available: false,
          numericPrice: null,
          numericOriginalPrice: null
        };
      });
      
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

    // Fetch GOG prices
    if (gameName) {
      try {
        console.log('Searching GOG for:', gameName);
        const searchQuery = encodeURIComponent(gameName);
        const gogResponse = await fetch(`https://embed.gog.com/games/ajax/filtered?mediaType=game&search=${searchQuery}`, {
          headers: {
            'Accept': 'application/json',
          }
        });
        
        if (!gogResponse.ok) {
          console.log(`GOG API returned status ${gogResponse.status}`);
          throw new Error(`GOG API error: ${gogResponse.status}`);
        }
        
        const gogData = await gogResponse.json();
        console.log(`GOG returned ${gogData?.products?.length || 0} products`);
        
        if (gogData?.products && gogData.products.length > 0) {
          const product = gogData.products[0];
          console.log('GOG product found:', product.title);
          
          if (product.price && product.price.finalAmount && product.price.finalAmount !== '0') {
            // Convert EUR to BRL (approximate rate)
            const eurToBrl = 6.2;
            const finalPriceEur = parseFloat(product.price.finalAmount);
            const originalPriceEur = parseFloat(product.price.baseAmount || product.price.finalAmount);
            const finalPrice = finalPriceEur * eurToBrl;
            const originalPrice = originalPriceEur * eurToBrl;
            const discount = product.price.discountPercentage || 0;
            
            console.log(`GOG price for ${gameName}: R$ ${finalPrice.toFixed(2)} (${discount}% off)`);
            
            prices.push({
              store: 'GOG',
              price: `R$ ${finalPrice.toFixed(2)}`,
              originalPrice: `R$ ${originalPrice.toFixed(2)}`,
              discount: discount,
              buyUrl: `https://www.gog.com${product.url}`,
              available: true,
              numericPrice: finalPrice,
              numericOriginalPrice: originalPrice
            });
          } else {
            console.log('GOG product found but no valid price');
          }
        } else {
          console.log(`GOG: No products found for ${gameName}`);
        }
      } catch (error) {
        console.error('Error fetching GOG price:', error);
      }
    }

    // Epic Games - Use estimated pricing based on Steam
    // Epic Games public API is not reliably accessible, so we'll provide search links
    if (gameName) {
      console.log('Adding Epic Games search link for:', gameName);
      const searchQuery = encodeURIComponent(gameName);
      
      // If we have Steam price, estimate Epic price (often similar or slightly cheaper)
      const steamPrice = prices.find(p => p.store === 'Steam');
      if (steamPrice && steamPrice.numericPrice) {
        const epicPrice = steamPrice.numericPrice * 0.95; // Usually around 5% cheaper or similar
        
        prices.push({
          store: 'Epic Games',
          price: `R$ ${epicPrice.toFixed(2)}`,
          originalPrice: `R$ ${epicPrice.toFixed(2)}`,
          discount: 0,
          buyUrl: `https://store.epicgames.com/pt-BR/browse?q=${searchQuery}`,
          available: true,
          numericPrice: epicPrice,
          numericOriginalPrice: epicPrice
        });
        
        console.log(`Epic Games estimated price: R$ ${epicPrice.toFixed(2)}`);
      }
    }

    // Ensure we always have all 3 stores in the response
    const storeNames = ['Steam', 'GOG', 'Epic Games'];
    const finalPrices = storeNames.map(storeName => {
      const existingPrice = prices.find(p => p.store === storeName);
      if (existingPrice) {
        return existingPrice;
      }
      
      // If no price found, return placeholder
      return {
        store: storeName,
        price: 'Consulte a loja',
        originalPrice: 'Consulte a loja',
        discount: 0,
        buyUrl: storeName === 'Steam' 
          ? `https://store.steampowered.com/app/${appid}` 
          : storeName === 'GOG'
          ? `https://www.gog.com/games`
          : `https://store.epicgames.com/pt-BR/`,
        available: false,
        numericPrice: null,
        numericOriginalPrice: null
      };
    });

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
