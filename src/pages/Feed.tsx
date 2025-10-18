import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Menu, Settings, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface GameDeal {
  gameID: string;
  dealID: string;
  title: string;
  thumb: string;
  salePrice: string;
  normalPrice: string;
  savings: string;
  storeID: string;
  cheapestPrice: string;
  genre: string;
}

const Feed = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<GameDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"genre" | "discount" | "alphabetic">("discount");
  const [exchangeRate, setExchangeRate] = useState(5.5);

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
    fetchExchangeRate();
  }, []);

  const fetchExchangeRate = async () => {
    try {
      const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
      const data = await response.json();
      if (data.rates && data.rates.BRL) {
        setExchangeRate(data.rates.BRL);
      }
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
    }
  };

  const convertToBRL = (usdPrice: string) => {
    return (parseFloat(usdPrice) * exchangeRate).toFixed(2);
  };

  const fetchGames = async () => {
    try {
      setLoading(true);
      
      // List of popular AAA games with genres
      const popularGames = [
        { name: "Grand Theft Auto V", genre: "Ação/Aventura" },
        { name: "Red Dead Redemption", genre: "Ação/Aventura" },
        { name: "Call of Duty", genre: "FPS" },
        { name: "Resident Evil", genre: "Terror/Sobrevivência" },
        { name: "Dark Souls", genre: "RPG/Ação" },
        { name: "Cyberpunk 2077", genre: "RPG/Ação" },
        { name: "The Witcher", genre: "RPG/Aventura" },
        { name: "Fallout", genre: "RPG/Aventura" },
        { name: "Elder Scrolls", genre: "MMORPG" },
        { name: "Assassin's Creed", genre: "Ação/Aventura" },
        { name: "Far Cry", genre: "FPS/Aventura" },
        { name: "Battlefield", genre: "FPS" },
        { name: "Borderlands", genre: "FPS/RPG" },
        { name: "Dying Light", genre: "Terror/Ação" },
        { name: "Dead by Daylight", genre: "Terror/Multiplayer" },
      ];

      // Fetch deals for AAA games
      const allGames: GameDeal[] = [];
      
      for (const game of popularGames.slice(0, 10)) {
        try {
          const searchResponse = await fetch(
            `https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(game.name)}&limit=1`
          );
          const searchData = await searchResponse.json();
          
          if (searchData && searchData.length > 0) {
            const gameId = searchData[0].gameID;
            const dealsResponse = await fetch(
              `https://www.cheapshark.com/api/1.0/games?id=${gameId}`
            );
            const gameData = await dealsResponse.json();
            
            if (gameData.deals && gameData.deals.length > 0) {
              const bestDeal = gameData.deals.reduce((prev: any, current: any) => 
                parseFloat(current.price) < parseFloat(prev.price) ? current : prev
              );
              
              allGames.push({
                gameID: gameId,
                dealID: bestDeal.dealID,
                title: gameData.info.title,
                thumb: gameData.info.thumb,
                salePrice: bestDeal.price,
                normalPrice: bestDeal.retailPrice,
                savings: bestDeal.savings || "0",
                storeID: bestDeal.storeID,
                cheapestPrice: gameData.cheapestPriceEver?.price || bestDeal.price,
                genre: game.genre,
              });
            }
          }
        } catch (err) {
          console.log(`Error fetching ${game.name}:`, err);
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
                key={game.dealID}
                onClick={() => navigate(`/game/${game.gameID}`)}
                className="bg-card border-2 border-foreground rounded-xl p-3 flex gap-3 hover:shadow-md transition-all hover:scale-[1.01] animate-in fade-in duration-300 cursor-pointer"
              >
                {/* Game Image */}
                <div className="flex-shrink-0">
                  <img
                    src={game.thumb}
                    alt={game.title}
                    className="w-20 h-20 object-cover rounded-lg shadow-sm"
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
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Base:</span>
                      <span className="line-through text-muted-foreground">
                        R$ {convertToBRL(game.normalPrice)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Atual:</span>
                      <span className="text-green-600 font-bold text-base">
                        R$ {convertToBRL(game.salePrice)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Menor:</span>
                      <span className="text-primary font-semibold text-xs">
                        R$ {convertToBRL(game.cheapestPrice)}
                      </span>
                    </div>
                    {parseFloat(game.savings) > 0 && (
                      <div className="inline-block px-2 py-0.5 bg-green-600 text-white rounded-full text-xs font-semibold mt-1">
                        -{parseFloat(game.savings).toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>

                {/* Favorite Button */}
                <button className="self-start p-1 hover:scale-110 transition-transform">
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
