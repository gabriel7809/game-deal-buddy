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

    if (!cacheError && cachedPrices && cachedPrices.length === 3 && availableStores >= 2) {
      console.log(`Using cached prices for appid ${appid} (${availableStores} stores available)`);
      const prices = cachedPrices.map(cp => ({
        store: cp.store,
        price: cp.price,
        originalPrice: cp.original_price,
        discount: cp.discount,
        buyUrl: cp.buy_url,
        available: cp.available,
        numericPrice: cp.numeric_price ? parseFloat(cp.numeric_price) : null,
        numericOriginalPrice: cp.numeric_original_price ? parseFloat(cp.numeric_original_price) : null
      }));
      
      return new Response(
        JSON.stringify({ prices }),
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
        console.log('Searching GOG...');
        const searchQuery = encodeURIComponent(gameName);
        const gogResponse = await fetch(`https://embed.gog.com/games/ajax/filtered?mediaType=game&search=${searchQuery}`);
        const gogData = await gogResponse.json();
        
        if (gogData?.products && gogData.products.length > 0) {
          const product = gogData.products[0];
          if (product.price && product.price.finalAmount) {
            const finalPrice = parseFloat(product.price.finalAmount);
            const originalPrice = parseFloat(product.price.baseAmount || product.price.finalAmount);
            const discount = product.price.discountPercentage || 0;
            
            console.log(`GOG price for ${gameName}: ${product.price.symbol} ${finalPrice} (${discount}% off)`);
            
            prices.push({
              store: 'GOG',
              price: `${product.price.symbol} ${finalPrice.toFixed(2)}`,
              originalPrice: `${product.price.symbol} ${originalPrice.toFixed(2)}`,
              discount: discount,
              buyUrl: `https://www.gog.com${product.url}`,
              available: true,
              numericPrice: finalPrice,
              numericOriginalPrice: originalPrice
            });
          }
        } else {
          console.log(`GOG: No results found for ${gameName}`);
          prices.push({
            store: 'GOG',
            price: 'N/A',
            originalPrice: 'N/A',
            discount: 0,
            buyUrl: `https://www.gog.com/games?query=${searchQuery}`,
            available: false,
            numericPrice: null,
            numericOriginalPrice: null
          });
        }
      } catch (error) {
        console.error('Error fetching GOG price:', error);
        prices.push({
          store: 'GOG',
          price: 'N/A',
          originalPrice: 'N/A',
          discount: 0,
          buyUrl: `https://www.gog.com/games`,
          available: false,
          numericPrice: null,
          numericOriginalPrice: null
        });
      }
    }

    // Fetch Epic Games prices
    if (gameName) {
      try {
        console.log('Searching Epic Games...');
        const searchQuery = encodeURIComponent(gameName);
        
        // Epic Games Store GraphQL API
        const epicResponse = await fetch('https://graphql.epicgames.com/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              query searchStoreQuery($query: String!, $locale: String!, $country: String!) {
                Catalog {
                  searchStore(query: $query, locale: $locale, country: $country, count: 5) {
                    elements {
                      title
                      id
                      productSlug
                      price(country: $country) {
                        totalPrice {
                          discountPrice
                          originalPrice
                          discount
                          currencyCode
                          fmtPrice {
                            originalPrice
                            discountPrice
                          }
                        }
                      }
                    }
                  }
                }
              }
            `,
            variables: {
              query: gameName,
              locale: 'pt-BR',
              country: 'BR'
            }
          })
        });
        
        const epicData = await epicResponse.json();
        
        if (epicData?.data?.Catalog?.searchStore?.elements && epicData.data.Catalog.searchStore.elements.length > 0) {
          const product = epicData.data.Catalog.searchStore.elements[0];
          
          if (product.price?.totalPrice) {
            const priceData = product.price.totalPrice;
            const finalPrice = priceData.discountPrice / 100;
            const originalPrice = priceData.originalPrice / 100;
            const discount = priceData.discount;
            
            console.log(`Epic Games price for ${gameName}: R$ ${finalPrice} (${discount}% off)`);
            
            prices.push({
              store: 'Epic Games',
              price: priceData.fmtPrice.discountPrice,
              originalPrice: priceData.fmtPrice.originalPrice,
              discount: discount,
              buyUrl: `https://store.epicgames.com/pt-BR/p/${product.productSlug || product.id}`,
              available: true,
              numericPrice: finalPrice,
              numericOriginalPrice: originalPrice
            });
          }
        } else {
          console.log(`Epic Games: No results found for ${gameName}`);
          prices.push({
            store: 'Epic Games',
            price: 'N/A',
            originalPrice: 'N/A',
            discount: 0,
            buyUrl: `https://store.epicgames.com/pt-BR/browse?q=${searchQuery}`,
            available: false,
            numericPrice: null,
            numericOriginalPrice: null
          });
        }
      } catch (error) {
        console.error('Error fetching Epic Games price:', error);
        prices.push({
          store: 'Epic Games',
          price: 'N/A',
          originalPrice: 'N/A',
          discount: 0,
          buyUrl: `https://store.epicgames.com/pt-BR/`,
          available: false,
          numericPrice: null,
          numericOriginalPrice: null
        });
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
