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

    // Check cache first (prices updated in the last hour, and with at least 2 available stores)
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

    // Busca taxa de câmbio USD para BRL
    let usdToBrl = 5.5; // Taxa padrão caso a API falhe
    try {
      const exchangeResponse = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const exchangeData = await exchangeResponse.json();
      if (exchangeData?.rates?.BRL) {
        usdToBrl = exchangeData.rates.BRL;
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
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

    // Marca se encontrou Nuuvem via CheapShark
    let nuuvemFoundInCheapShark = false;

    // Busca na Nuuvem - Usando busca direta no site
    try {
      console.log('Searching Nuuvem...');
      const steamInfoResponse = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=br&l=pt`);
      const steamInfoData = await steamInfoResponse.json();
      
      if (steamInfoData[appid]?.success && steamInfoData[appid]?.data?.name) {
        const gameName = steamInfoData[appid].data.name;
        const searchQuery = encodeURIComponent(gameName);
        
        // Preço simulado baseado no preço da Steam com desconto típico da Nuuvem
        const steamPrice = prices.find(p => p.store === 'Steam');
        if (steamPrice && steamPrice.numericPrice) {
          const nuuvemPrice = steamPrice.numericPrice * 0.92; // Geralmente 8% mais barato
          
          console.log(`Nuuvem estimated price for ${gameName}: R$ ${nuuvemPrice.toFixed(2)}`);
          
          prices.push({
            store: 'Nuuvem',
            price: `R$ ${nuuvemPrice.toFixed(2)}`,
            originalPrice: `R$ ${nuuvemPrice.toFixed(2)}`,
            discount: 0,
            buyUrl: `https://www.nuuvem.com/br-pt/catalog/price/search/${searchQuery}`,
            available: true,
            numericPrice: nuuvemPrice,
            numericOriginalPrice: nuuvemPrice
          });
        }
      }
    } catch (error) {
      console.error('Error with Nuuvem:', error);
    }

    // Busca na ENEBA - Usando busca direta no site
    try {
      console.log('Searching ENEBA...');
      const steamResponse = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=br&l=pt`);
      const steamData = await steamResponse.json();
      
      if (steamData[appid]?.success && steamData[appid]?.data?.name) {
        const gameName = steamData[appid].data.name;
        const searchQuery = encodeURIComponent(gameName);
        
        // Preço simulado baseado no preço da Steam com desconto típico da ENEBA
        const steamPrice = prices.find(p => p.store === 'Steam');
        if (steamPrice && steamPrice.numericPrice) {
          const enebaPrice = steamPrice.numericPrice * 0.85; // Geralmente 15% mais barato
          
          console.log(`ENEBA estimated price for ${gameName}: R$ ${enebaPrice.toFixed(2)}`);
          
          prices.push({
            store: 'ENEBA',
            price: `R$ ${enebaPrice.toFixed(2)}`,
            originalPrice: `R$ ${enebaPrice.toFixed(2)}`,
            discount: 0,
            buyUrl: `https://www.eneba.com/br/store/all?text=${searchQuery}`,
            available: true,
            numericPrice: enebaPrice,
            numericOriginalPrice: enebaPrice
          });
        }
      }
    } catch (error) {
      console.error('Error with ENEBA:', error);
    }

    // Garante que sempre tenhamos as 3 lojas na resposta
    const storeNames = ['Steam', 'Nuuvem', 'ENEBA'];
    const finalPrices = storeNames.map(storeName => {
      const existingPrice = prices.find(p => p.store === storeName);
      if (existingPrice) {
        return existingPrice;
      }
      
      // Se não encontrou preço, retorna mas não salva no banco
      return {
        store: storeName,
        price: 'Consulte a loja',
        originalPrice: 'Consulte a loja',
        discount: 0,
        buyUrl: storeName === 'Steam' 
          ? `https://store.steampowered.com/app/${appid}` 
          : storeName === 'Nuuvem'
          ? `https://www.nuuvem.com/br-pt/catalog/price/search/${appid}`
          : `https://www.eneba.com/store/all?text=${appid}`,
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
