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
        
        // Try GOG search API
        const gogResponse = await fetch(`https://catalog.gog.com/v1/catalog?query=${searchQuery}&limit=5&order=desc:trending`, {
          headers: {
            'Accept': 'application/json',
          }
        });
        
        if (gogResponse.ok) {
          const gogData = await gogResponse.json();
          console.log(`GOG catalog returned ${gogData?.products?.length || 0} products`);
          
          if (gogData?.products && gogData.products.length > 0) {
            // Find best match
            const product = gogData.products[0];
            console.log('GOG product found:', product.title);
            
            // Fetch product details to get pricing
            try {
              const productId = product.id;
              const priceResponse = await fetch(`https://api.gog.com/products/${productId}/prices?countryCode=BR`);
              
              if (priceResponse.ok) {
                const priceData = await priceResponse.json();
                console.log('GOG price data:', JSON.stringify(priceData));
                
                if (priceData?._embedded?.prices && priceData._embedded.prices.length > 0) {
                  const price = priceData._embedded.prices[0];
                  const finalPrice = parseFloat(price.finalPrice) / 100; // Price in cents
                  const basePrice = parseFloat(price.basePrice) / 100;
                  const discount = price.discountPercentage || 0;
                  
                  console.log(`GOG price for ${gameName}: R$ ${finalPrice.toFixed(2)} (${discount}% off)`);
                  
                  prices.push({
                    store: 'GOG',
                    price: `R$ ${finalPrice.toFixed(2)}`,
                    originalPrice: `R$ ${basePrice.toFixed(2)}`,
                    discount: discount,
                    buyUrl: `https://www.gog.com/game/${product.slug}`,
                    available: true,
                    numericPrice: finalPrice,
                    numericOriginalPrice: basePrice
                  });
                } else {
                  console.log('GOG: No price data available');
                }
              }
            } catch (priceError) {
              console.error('Error fetching GOG product price:', priceError);
            }
          } else {
            console.log(`GOG: No products found for ${gameName}`);
          }
        } else {
          console.log(`GOG API returned status ${gogResponse.status}`);
        }
      } catch (error) {
        console.error('Error fetching GOG price:', error);
      }
    }

    // Fetch Epic Games prices
    if (gameName) {
      try {
        console.log('Searching Epic Games for:', gameName);
        const searchQuery = encodeURIComponent(gameName);
        
        // Epic Games GraphQL API
        const epicResponse = await fetch('https://store.epicgames.com/graphql', {
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
                      namespace
                      catalogNs {
                        mappings(pageType: "productHome") {
                          pageSlug
                        }
                      }
                      price(locale: $locale) {
                        totalPrice {
                          discountPrice
                          originalPrice
                          discount
                          currencyCode
                          fmtPrice(locale: $locale) {
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
        
        if (epicResponse.ok) {
          const epicData = await epicResponse.json();
          const elements = epicData?.data?.Catalog?.searchStore?.elements;
          console.log(`Epic Games returned ${elements?.length || 0} products`);
          
          if (elements && elements.length > 0) {
            // Find first game with valid price
            for (const element of elements) {
              if (element.price?.totalPrice) {
                const priceData = element.price.totalPrice;
                const finalPrice = priceData.discountPrice / 100;
                const originalPrice = priceData.originalPrice / 100;
                const discount = priceData.discount || 0;
                
                console.log(`Epic Games price for ${element.title}: R$ ${finalPrice.toFixed(2)} (${discount}% off)`);
                
                // Get product URL slug
                const slug = element.catalogNs?.mappings?.[0]?.pageSlug || element.id;
                
                prices.push({
                  store: 'Epic Games',
                  price: `R$ ${finalPrice.toFixed(2)}`,
                  originalPrice: `R$ ${originalPrice.toFixed(2)}`,
                  discount: discount,
                  buyUrl: `https://store.epicgames.com/pt-BR/p/${slug}`,
                  available: true,
                  numericPrice: finalPrice,
                  numericOriginalPrice: originalPrice
                });
                
                break; // Use first valid result
              }
            }
          } else {
            console.log(`Epic Games: No products found for ${gameName}`);
          }
        } else {
          console.log(`Epic Games API returned status ${epicResponse.status}`);
        }
      } catch (error) {
        console.error('Error fetching Epic Games price:', error);
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
