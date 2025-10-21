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

    // Busca preços de múltiplas lojas conhecidas
    const stores = [
      { name: 'Steam', url: `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=br&l=pt`, buyUrl: `https://store.steampowered.com/app/${appid}` },
      { name: 'Nuuvem', url: '', buyUrl: 'https://www.nuuvem.com/br-pt/', price: 'N/A' },
      { name: 'Green Man Gaming', url: '', buyUrl: 'https://www.greenmangaming.com/', price: 'N/A' },
      { name: 'Epic Games', url: '', buyUrl: 'https://store.epicgames.com/', price: 'N/A' },
    ];

    const prices = [];

    // Busca preço da Steam
    try {
      const steamResponse = await fetch(stores[0].url);
      const steamData = await steamResponse.json();
      
      if (steamData[appid]?.success && steamData[appid]?.data?.price_overview) {
        const priceData = steamData[appid].data.price_overview;
        prices.push({
          store: 'Steam',
          price: priceData.final_formatted,
          originalPrice: priceData.initial_formatted,
          discount: priceData.discount_percent,
          buyUrl: stores[0].buyUrl,
          available: true
        });
      } else {
        prices.push({
          store: 'Steam',
          price: 'N/A',
          originalPrice: 'N/A',
          discount: 0,
          buyUrl: stores[0].buyUrl,
          available: false
        });
      }
    } catch (error) {
      prices.push({
        store: 'Steam',
        price: 'N/A',
        originalPrice: 'N/A',
        discount: 0,
        buyUrl: stores[0].buyUrl,
        available: false
      });
    }

    // Adiciona outras lojas (simuladas - você pode integrar APIs reais se disponíveis)
    for (let i = 1; i < stores.length; i++) {
      prices.push({
        store: stores[i].name,
        price: 'Consultar',
        originalPrice: '-',
        discount: 0,
        buyUrl: stores[i].buyUrl,
        available: false
      });
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
