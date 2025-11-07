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

    // Marca se encontrou Nuuvem via CheapShark
    let nuuvemFoundInCheapShark = false;

    // Busca direta na Nuuvem
    try {
      console.log('Fetching direct Nuuvem prices...');
      
      // Busca na API interna da Nuuvem (usado pelo site deles)
      const nuuvemSearchUrl = `https://www.nuuvem.com/api-v2/products/search?q=${appid}&sort=relevance`;
      const nuuvemResponse = await fetch(nuuvemSearchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      });
      
      if (nuuvemResponse.ok) {
        const nuuvemData = await nuuvemResponse.json();
        
        // Procura pelo jogo com o appid correspondente
        if (nuuvemData?.products && nuuvemData.products.length > 0) {
          for (const product of nuuvemData.products) {
            // Verifica se o produto tem o Steam App ID no slug ou metadata
            if (product.slug?.includes(appid) || product.platforms?.includes('steam')) {
              const currentPrice = product.price?.brl || product.price?.amount;
              const originalPrice = product.price?.full_brl || product.price?.original_amount || currentPrice;
              
              if (currentPrice) {
                const discount = originalPrice && originalPrice > currentPrice 
                  ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) 
                  : 0;
                
                console.log(`Found on Nuuvem: ${product.name} - R$ ${currentPrice}`);
                
                prices.push({
                  store: 'Nuuvem',
                  price: `R$ ${currentPrice.toFixed(2)}`,
                  originalPrice: `R$ ${originalPrice.toFixed(2)}`,
                  discount: discount,
                  buyUrl: `https://www.nuuvem.com/br-pt/item/${product.slug}`,
                  available: true,
                  numericPrice: currentPrice,
                  numericOriginalPrice: originalPrice
                });
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching direct Nuuvem price:', error);
    }

    // Busca direta na ENEBA
    try {
      console.log('Fetching ENEBA prices...');
      
      // Busca o jogo no Steam primeiro para pegar o nome
      const steamResponse = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=br&l=pt`);
      const steamData = await steamResponse.json();
      
      if (steamData[appid]?.success && steamData[appid]?.data?.name) {
        const gameName = steamData[appid].data.name;
        const searchQuery = encodeURIComponent(gameName + ' steam');
        
        // Busca na página de pesquisa da ENEBA
        const enebaSearchUrl = `https://www.eneba.com/store/all?text=${searchQuery}`;
        const enebaResponse = await fetch(enebaSearchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml',
          }
        });
        
        if (enebaResponse.ok) {
          const htmlText = await enebaResponse.text();
          
          // Procura por padrões de preço no HTML (formato: R$ XX.XX ou BRL)
          // Isso é uma implementação básica - pode precisar de ajustes
          const priceMatch = htmlText.match(/R\$\s*(\d+[.,]\d{2})/);
          
          if (priceMatch) {
            const priceStr = priceMatch[1].replace(',', '.');
            const currentPrice = parseFloat(priceStr);
            
            console.log(`Found on ENEBA: ${gameName} - R$ ${currentPrice}`);
            
            prices.push({
              store: 'ENEBA',
              price: `R$ ${currentPrice.toFixed(2)}`,
              originalPrice: `R$ ${currentPrice.toFixed(2)}`,
              discount: 0,
              buyUrl: enebaSearchUrl,
              available: true,
              numericPrice: currentPrice,
              numericOriginalPrice: currentPrice
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching ENEBA price:', error);
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
