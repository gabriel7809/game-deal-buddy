import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Menu, Settings, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface GameDeal {
  appid: string;
  title: string;
  header_image: string;
  current_price: number;
  original_price: number;
  discount_percent: number;
  price_formatted: string;
  genre: string;
}

const Feed = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<GameDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"genre" | "discount" | "alphabetic">("discount");

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      setLoading(true);
      
      // Lista de jogos populares com seus Steam App IDs
      const popularGames = [
        { appid: "271590", genre: "Ação/Aventura" }, // Grand Theft Auto V
        { appid: "1174180", genre: "Ação/Aventura" }, // Red Dead Redemption 2
        { appid: "1938090", genre: "FPS" }, // Call of Duty: Black Ops 6
        { appid: "2050650", genre: "Terror/Sobrevivência" }, // Resident Evil 4
        { appid: "570940", genre: "RPG/Ação" }, // Dark Souls Remastered
        { appid: "1091500", genre: "RPG/Ação" }, // Cyberpunk 2077
        { appid: "292030", genre: "RPG/Aventura" }, // The Witcher 3
        { appid: "1151340", genre: "RPG/Aventura" }, // Fallout 4
        { appid: "306130", genre: "MMORPG" }, // The Elder Scrolls Online
        { appid: "2215430", genre: "Ação/Aventura" }, // Assassin's Creed Mirage
      ];

      const allGames: GameDeal[] = [];
      
      for (const game of popularGames) {
        try {
          // Busca detalhes do jogo
          const { data, error } = await supabase.functions.invoke('fetch-steam-games', {
            body: { appid: game.appid }
          });
          
          if (error) throw error;
          
          if (data[game.appid]?.success && data[game.appid]?.data) {
            const gameData = data[game.appid].data;
            
            // Verifica se o jogo tem preço (alguns podem ser gratuitos ou não disponíveis)
            if (gameData.price_overview) {
              const priceData = gameData.price_overview;
              let lowestCurrentPrice = priceData.final / 100;
              let lowestOriginalPrice = priceData.initial / 100;
              let bestDiscount = priceData.discount_percent;
              let bestPriceFormatted = priceData.final_formatted;
              
              // Busca preços de múltiplas lojas
              try {
                const { data: pricesData, error: pricesError } = await supabase.functions.invoke('fetch-game-prices', {
                  body: { appid: game.appid }
                });

                // Se encontrou preços de outras lojas, compara para achar o menor
                if (!pricesError && pricesData?.prices) {
                  const availablePrices = pricesData.prices.filter((p: any) => 
                    p.available && p.numericPrice !== null && p.numericPrice > 0
                  );
                  
                  if (availablePrices.length > 0) {
                    const cheapest = availablePrices.reduce((min: any, current: any) => 
                      current.numericPrice < min.numericPrice ? current : min
                    );
                    
                    if (cheapest.numericPrice < lowestCurrentPrice) {
                      lowestCurrentPrice = cheapest.numericPrice;
                      lowestOriginalPrice = parseFloat(cheapest.originalPrice.replace('R$ ', ''));
                      bestDiscount = cheapest.discount;
                      bestPriceFormatted = cheapest.price;
                    }
                  }
                }
              } catch (pricesErr) {
                console.log(`Error fetching prices for ${game.appid}:`, pricesErr);
              }
              
              allGames.push({
                appid: game.appid,
                title: gameData.name,
                header_image: gameData.header_image,
                current_price: lowestCurrentPrice,
                original_price: lowestOriginalPrice,
                discount_percent: bestDiscount,
                price_formatted: bestPriceFormatted,
                genre: game.genre,
              });
            }
          }
        } catch (err) {
          console.log(`Error fetching game ${game.appid}:`, err);
        }
      }
      
      setGames(allGames);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível carregar os jogos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredGames = games.filter(game =>
    game.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-foreground/10">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button className="p-2">
              <Menu className="w-6 h-6 text-foreground" />
            </button>
            
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Procurar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 bg-muted/80 border-0 h-12"
              />
            </div>
            
            <button onClick={handleLogout} className="p-2">
              <Settings className="w-6 h-6 text-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-primary text-center">
          Compare os preços e faça sua compra com mais eficiência!
        </h1>

        {/* Filter Buttons */}
        <div className="flex gap-3 justify-center flex-wrap">
          <Button
            onClick={() => setSortBy("genre")}
            variant={sortBy === "genre" ? "default" : "secondary"}
            className="rounded-full px-6"
          >
            Gênero
          </Button>
          <Button
            onClick={() => setSortBy("discount")}
            variant={sortBy === "discount" ? "default" : "secondary"}
            className="rounded-full px-6"
          >
            Desconto
          </Button>
          <Button
            onClick={() => setSortBy("alphabetic")}
            variant={sortBy === "alphabetic" ? "default" : "secondary"}
            className="rounded-full px-6"
          >
            Ordem Alfabética
          </Button>
        </div>

        {/* Games List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">Carregando jogos...</p>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">Nenhum jogo encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGames.map((game) => (
              <div
                key={game.appid}
                onClick={() => navigate(`/game/${game.appid}`)}
                className="bg-card border-2 border-foreground rounded-xl p-3 flex gap-3 hover:shadow-md transition-all hover:scale-[1.01] animate-in fade-in duration-300 cursor-pointer"
              >
                {/* Game Image */}
                <div className="flex-shrink-0">
                  <img
                    src={game.header_image}
                    alt={game.title}
                    className="w-32 h-20 object-cover rounded-lg shadow-sm"
                  />
                </div>

                {/* Game Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="text-sm font-bold text-foreground line-clamp-1 leading-tight">
                    {game.title}
                  </h3>
                  
                  <p className="text-xs text-muted-foreground mb-1">
                    {game.genre}
                  </p>
                  
                  <div className="space-y-0.5 text-xs">
                    {game.discount_percent > 0 ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">De:</span>
                          <span className="line-through text-muted-foreground">
                            R$ {game.original_price.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Por:</span>
                          <span className="text-green-600 font-bold text-base">
                            {game.price_formatted}
                          </span>
                          <span className="inline-block px-2 py-0.5 bg-green-600 text-white rounded-full text-xs font-semibold">
                            -{game.discount_percent}%
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Preço:</span>
                        <span className="text-foreground font-bold text-base">
                          {game.price_formatted}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Favorite Button */}
                <button 
                  className="self-start p-1 hover:scale-110 transition-transform"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Heart className="w-5 h-5 text-foreground hover:fill-current transition-colors" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;
