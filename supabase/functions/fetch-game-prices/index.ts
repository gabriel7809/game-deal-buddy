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

    // Busca preço da Steam
    try {
      const steamResponse = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=br&l=pt`);
      const steamData = await steamResponse.json();
      
      if (steamData[appid]?.success && steamData[appid]?.data?.price_overview) {
        const priceData = steamData[appid].data.price_overview;
        prices.push({
          store: 'Steam',
          price: priceData.final_formatted,
          originalPrice: priceData.initial_formatted,
          discount: priceData.discount_percent,
          buyUrl: `https://store.steampowered.com/app/${appid}`,
          available: true,
          numericPrice: priceData.final / 100
        });
      } else {
        prices.push({
          store: 'Steam',
          price: 'N/A',
          originalPrice: 'N/A',
          discount: 0,
          buyUrl: `https://store.steampowered.com/app/${appid}`,
          available: false,
          numericPrice: null
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
        numericPrice: null
      });
    }

    // Busca preços de múltiplas lojas via CheapShark
    try {
      const cheapSharkResponse = await fetch(`https://www.cheapshark.com/api/1.0/games?steamAppID=${appid}`);
      const cheapSharkData = await cheapSharkResponse.json();
      
      if (cheapSharkData && cheapSharkData.length > 0) {
        const game = cheapSharkData[0];
        
        // Mapeia store IDs do CheapShark para nomes conhecidos
        const storeMap: { [key: string]: { name: string, baseUrl: string } } = {
          '1': { name: 'Steam', baseUrl: 'https://store.steampowered.com/app/' },
          '2': { name: 'GamersGate', baseUrl: 'https://www.gamersgate.com' },
          '3': { name: 'GreenManGaming', baseUrl: 'https://www.greenmangaming.com' },
          '7': { name: 'GOG', baseUrl: 'https://www.gog.com' },
          '8': { name: 'Origin', baseUrl: 'https://www.origin.com' },
          '11': { name: 'Humble Store', baseUrl: 'https://www.humblebundle.com/store' },
          '13': { name: 'Uplay', baseUrl: 'https://store.ubi.com' },
          '15': { name: 'Fanatical', baseUrl: 'https://www.fanatical.com' },
          '25': { name: 'Epic Games', baseUrl: 'https://store.epicgames.com' },
        };

        // Busca deals para este jogo
        const dealsResponse = await fetch(`https://www.cheapshark.com/api/1.0/games?id=${game.gameID}`);
        const dealsData = await dealsResponse.json();
        
        if (dealsData?.deals) {
          const storeDeals = dealsData.deals.filter((deal: any) => deal.storeID !== '1'); // Exclui Steam já adicionado
          
          for (const deal of storeDeals.slice(0, 4)) { // Limita a 4 lojas adicionais
            const store = storeMap[deal.storeID];
            if (store) {
              const salePrice = parseFloat(deal.price);
              const retailPrice = parseFloat(deal.retailPrice);
              const discount = Math.round(((retailPrice - salePrice) / retailPrice) * 100);
              
              prices.push({
                store: store.name,
                price: `R$ ${salePrice.toFixed(2)}`,
                originalPrice: `R$ ${retailPrice.toFixed(2)}`,
                discount: discount > 0 ? discount : 0,
                buyUrl: `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`,
                available: true,
                numericPrice: salePrice
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching CheapShark prices:', error);
    }

    // Se não encontrou outras lojas, adiciona placeholders
    if (prices.length === 1) {
      const placeholderStores = [
        { name: 'Nuuvem', buyUrl: 'https://www.nuuvem.com/br-pt/' },
        { name: 'Green Man Gaming', buyUrl: 'https://www.greenmangaming.com/' },
        { name: 'Epic Games', buyUrl: 'https://store.epicgames.com/' },
      ];
      
      for (const store of placeholderStores) {
        prices.push({
          store: store.name,
          price: 'Consultar',
          originalPrice: '-',
          discount: 0,
          buyUrl: store.buyUrl,
          available: false,
          numericPrice: null
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
