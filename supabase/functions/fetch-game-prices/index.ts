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

    // Busca preços via IsThereAnyDeal API (mais confiável e com mais lojas)
    try {
      // Primeiro busca o plain do jogo
      const plainResponse = await fetch(`https://api.isthereanydeal.com/games/lookup/v1?key=67e2b7f4b2b2a91c2f8e7d8b3c4d5e6f&appid=${appid}`);
      const plainData = await plainResponse.json();
      
      if (plainData?.game?.id) {
        const gameId = plainData.game.id;
        
        // Busca preços atuais
        const pricesResponse = await fetch(`https://api.isthereanydeal.com/games/prices/v2?key=67e2b7f4b2b2a91c2f8e7d8b3c4d5e6f&id=${gameId}&region=br&country=BR&shops=steam,gog,epic,greenmangaming,humblestore,nuuvem,fanatical`);
        const pricesData = await pricesResponse.json();
        
        if (pricesData?.deals) {
          const storeNameMap: { [key: string]: string } = {
            'gog': 'GOG',
            'epic': 'Epic Games',
            'greenmangaming': 'Green Man Gaming',
            'humblestore': 'Humble Store',
            'nuuvem': 'Nuuvem',
            'fanatical': 'Fanatical'
          };

          for (const deal of pricesData.deals) {
            if (deal.shop.id === 'steam') continue; // Steam já foi adicionado
            
            const storeName = storeNameMap[deal.shop.id] || deal.shop.name;
            const currentPrice = deal.price.amount;
            const regularPrice = deal.regular.amount;
            const discount = deal.cut || 0;
            
            // Converte de USD para BRL
            const currentPriceBRL = currentPrice * usdToBrl;
            const regularPriceBRL = regularPrice * usdToBrl;
            
            prices.push({
              store: storeName,
              price: `R$ ${currentPriceBRL.toFixed(2)}`,
              originalPrice: `R$ ${regularPriceBRL.toFixed(2)}`,
              discount: discount,
              buyUrl: deal.url,
              available: true,
              numericPrice: currentPriceBRL,
              numericOriginalPrice: regularPriceBRL
            });
          }
        }
      }
    } catch (error) {
      console.log('ITAD API not available, falling back to CheapShark:', error);
      
      // Fallback: Busca via CheapShark
      try {
        const cheapSharkResponse = await fetch(`https://www.cheapshark.com/api/1.0/games?steamAppID=${appid}`);
        const cheapSharkData = await cheapSharkResponse.json();
        
        if (cheapSharkData && cheapSharkData.length > 0) {
          const game = cheapSharkData[0];
          
          const storeMap: { [key: string]: { name: string } } = {
            '7': { name: 'GOG' },
            '25': { name: 'Epic Games' },
            '3': { name: 'Green Man Gaming' },
            '11': { name: 'Humble Store' },
          };

          const dealsResponse = await fetch(`https://www.cheapshark.com/api/1.0/games?id=${game.gameID}`);
          const dealsData = await dealsResponse.json();
          
          if (dealsData?.deals) {
            const storeDeals = dealsData.deals.filter((deal: any) => deal.storeID !== '1');
            
            for (const deal of storeDeals.slice(0, 5)) {
              const store = storeMap[deal.storeID];
              if (store) {
                const salePriceUSD = parseFloat(deal.price);
                const retailPriceUSD = parseFloat(deal.retailPrice);
                const discount = Math.round(((retailPriceUSD - salePriceUSD) / retailPriceUSD) * 100);
                
                const salePriceBRL = salePriceUSD * usdToBrl;
                const retailPriceBRL = retailPriceUSD * usdToBrl;
                
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
      } catch (cheapSharkError) {
        console.error('Error fetching CheapShark prices:', cheapSharkError);
      }
    }

    // Busca preços adicionais via APIs específicas das lojas
    
    // GOG API (se ainda não tiver)
    if (!prices.some(p => p.store === 'GOG')) {
      try {
        const gogSearchResponse = await fetch(`https://embed.gog.com/games/ajax/filtered?mediaType=game&search=${appid}`);
        const gogSearchData = await gogSearchResponse.json();
        
        if (gogSearchData?.products && gogSearchData.products.length > 0) {
          const gogGame = gogSearchData.products[0];
          const price = gogGame.price?.amount || 0;
          const basePrice = gogGame.price?.baseAmount || price;
          const discount = gogGame.price?.discountPercentage || 0;
          
          if (price > 0) {
            const priceBRL = price * usdToBrl;
            const basePriceBRL = basePrice * usdToBrl;
            
            prices.push({
              store: 'GOG',
              price: `R$ ${priceBRL.toFixed(2)}`,
              originalPrice: `R$ ${basePriceBRL.toFixed(2)}`,
              discount: discount,
              buyUrl: `https://www.gog.com${gogGame.url}`,
              available: true,
              numericPrice: priceBRL,
              numericOriginalPrice: basePriceBRL
            });
          }
        }
      } catch (error) {
        console.log('GOG API not available:', error);
      }
    }
    
    // Se não encontrou outras lojas, adiciona placeholders
    if (prices.length === 1) {
      const placeholderStores = [
        { name: 'Nuuvem', buyUrl: 'https://www.nuuvem.com/br-pt/' },
        { name: 'Green Man Gaming', buyUrl: 'https://www.greenmangaming.com/' },
        { name: 'GOG', buyUrl: 'https://www.gog.com/' },
        { name: 'Epic Games', buyUrl: 'https://store.epicgames.com/' },
      ];
      
      for (const store of placeholderStores) {
        prices.push({
          store: store.name,
          price: 'Consultar Site',
          originalPrice: '-',
          discount: 0,
          buyUrl: store.buyUrl,
          available: false,
          numericPrice: null,
          numericOriginalPrice: null
        });
      }
    }

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
