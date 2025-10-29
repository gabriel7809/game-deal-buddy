import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const prices = [];

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

    // Busca preços via CheapShark API (API pública e confiável)
    try {
      console.log(`Fetching CheapShark prices for appid: ${appid}`);
      const cheapSharkResponse = await fetch(`https://www.cheapshark.com/api/1.0/games?steamAppID=${appid}`);
      const cheapSharkData = await cheapSharkResponse.json();
      
      console.log(`CheapShark response:`, JSON.stringify(cheapSharkData).substring(0, 200));
      
      if (cheapSharkData && cheapSharkData.length > 0) {
        const game = cheapSharkData[0];
        console.log(`Found game on CheapShark: ${game.external}`);
        
        const storeMap: { [key: string]: { name: string, baseUrl: string } } = {
          '7': { name: 'GOG', baseUrl: 'https://www.gog.com' },
          '25': { name: 'Epic Games', baseUrl: 'https://store.epicgames.com' },
          '3': { name: 'Green Man Gaming', baseUrl: 'https://www.greenmangaming.com' },
          '11': { name: 'Humble Store', baseUrl: 'https://www.humblebundle.com/store' },
          '15': { name: 'Fanatical', baseUrl: 'https://www.fanatical.com' },
          '8': { name: 'Nuuvem', baseUrl: 'https://www.nuuvem.com' },
        };

        // Busca os deals específicos deste jogo
        const dealsResponse = await fetch(`https://www.cheapshark.com/api/1.0/games?id=${game.gameID}`);
        const dealsData = await dealsResponse.json();
        
        console.log(`Deals found:`, dealsData?.deals?.length || 0);
        
        if (dealsData?.deals) {
          // Filtra deals que não são da Steam e pega os melhores preços
          const storeDeals = dealsData.deals.filter((deal: any) => deal.storeID !== '1');
          
          for (const deal of storeDeals) {
            const store = storeMap[deal.storeID];
            if (store) {
              const salePriceUSD = parseFloat(deal.price);
              const retailPriceUSD = parseFloat(deal.retailPrice);
              
              // Só adiciona se tiver preço válido
              if (salePriceUSD > 0 && retailPriceUSD > 0) {
                const discount = Math.round(((retailPriceUSD - salePriceUSD) / retailPriceUSD) * 100);
                
                const salePriceBRL = salePriceUSD * usdToBrl;
                const retailPriceBRL = retailPriceUSD * usdToBrl;
                
                console.log(`Adding ${store.name}: R$ ${salePriceBRL.toFixed(2)} (${discount}% off)`);
                
                prices.push({
                  store: store.name,
                  price: `R$ ${salePriceBRL.toFixed(2)}`,
                  originalPrice: `R$ ${retailPriceBRL.toFixed(2)}`,
                  discount: discount > 0 ? discount : 0,
                  buyUrl: `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`,
                  available: true,
                  numericPrice: salePriceBRL,
                  numericOriginalPrice: retailPriceBRL
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching CheapShark prices:', error);
    }

    console.log(`Total prices found: ${prices.length}`);

    return new Response(
      JSON.stringify({ prices }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
