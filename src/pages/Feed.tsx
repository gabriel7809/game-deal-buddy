import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Settings, Heart, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { NavigationDrawer } from "@/components/NavigationDrawer";

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
  const [sortBy, setSortBy] = useState<"discount" | "alphabetic">("discount");
  const [selectedGenre, setSelectedGenre] = useState<string>("Todos");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

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
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("favorites")
        .select("appid")
        .eq("user_id", user.id);

      if (error) throw error;

      if (data) {
        setFavorites(new Set(data.map(fav => fav.appid)));
      }
    } catch (error: any) {
      console.error("Error fetching favorites:", error);
    }
  };

  const toggleFavorite = async (game: GameDeal, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const isFavorited = favorites.has(game.appid);

      if (isFavorited) {
        // Remove from favorites
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("appid", game.appid);

        if (error) throw error;

        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(game.appid);
          return newSet;
        });

        toast({
          title: "Removido dos favoritos",
          description: `${game.title} foi removido dos seus favoritos`,
        });
      } else {
        // Add to favorites
        const { error } = await supabase
          .from("favorites")
          .insert({
            user_id: user.id,
            appid: game.appid,
            title: game.title,
            header_image: game.header_image,
            current_price: game.current_price,
            original_price: game.original_price,
            discount_percent: game.discount_percent,
            price_formatted: game.price_formatted,
            genre: game.genre,
          });

        if (error) throw error;

        setFavorites(prev => new Set(prev).add(game.appid));

        toast({
          title: "Adicionado aos favoritos",
          description: `${game.title} foi adicionado aos seus favoritos`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar favoritos",
        variant: "destructive",
      });
    }
  };

  const fetchGames = async () => {
    try {
      setLoading(true);
      
      // Lista expandida de jogos populares com seus Steam App IDs
      const popularGames = [
        { appid: "1174180", genre: "Ação/Aventura" }, // Red Dead Redemption 2
        { appid: "2050650", genre: "Terror/Sobrevivência" }, // Resident Evil 4
        { appid: "570940", genre: "RPG/Ação" }, // Dark Souls Remastered
        { appid: "1091500", genre: "RPG/Ação" }, // Cyberpunk 2077
        { appid: "292030", genre: "RPG/Aventura" }, // The Witcher 3
        { appid: "271590", genre: "Ação/Aventura" }, // Grand Theft Auto V
        { appid: "1938090", genre: "FPS" }, // Call of Duty: Black Ops 6
        { appid: "1151340", genre: "RPG/Aventura" }, // Fallout 4
        { appid: "306130", genre: "MMORPG" }, // The Elder Scrolls Online
        { appid: "2215430", genre: "Ação/Aventura" }, // Assassin's Creed Mirage
        { appid: "976730", genre: "Simulação/Esportes" }, // Halo: The Master Chief Collection
        { appid: "1449560", genre: "FPS" }, // Battlefield 2042
        { appid: "1172380", genre: "Ação/Aventura" }, // Star Wars Jedi: Fallen Order
        { appid: "1245620", genre: "Ação/Aventura" }, // Elden Ring
      ];

      // Busca todos os jogos em paralelo
      const gamePromises = popularGames.map(async (game) => {
        try {
          // Busca dados do jogo e preços em paralelo
          const [gameResponse, pricesResponse] = await Promise.all([
            supabase.functions.invoke('fetch-steam-games', {
              body: { appid: game.appid }
            }),
            supabase.functions.invoke('fetch-game-prices', {
              body: { appid: game.appid }
            }).catch(() => ({ data: null, error: null })) // Não falha se preços não carregarem
          ]);
          
          if (gameResponse.error || !gameResponse.data[game.appid]?.success) {
            return null;
          }
          
          const gameData = gameResponse.data[game.appid].data;
          
          // Verifica se o jogo tem preço
          if (!gameData.price_overview) {
            return null;
          }

          const priceData = gameData.price_overview;
          let lowestCurrentPrice = priceData.final / 100;
          let lowestOriginalPrice = priceData.initial / 100 || lowestCurrentPrice;
          let bestDiscount = priceData.discount_percent;
          let bestPriceFormatted = priceData.final_formatted;
          
          // Se encontrou preços de outras lojas, compara para achar o menor
          if (pricesResponse.data?.prices) {
            const availablePrices = pricesResponse.data.prices.filter((p: any) => 
              p.available && p.numericPrice !== null && p.numericPrice > 0
            );
            
            if (availablePrices.length > 0) {
              const cheapest = availablePrices.reduce((min: any, current: any) => 
                current.numericPrice < min.numericPrice ? current : min
              );
              
              if (cheapest.numericPrice < lowestCurrentPrice) {
                lowestCurrentPrice = cheapest.numericPrice;
                lowestOriginalPrice = parseFloat(cheapest.originalPrice.replace('R$ ', '').replace(',', '.')) || lowestCurrentPrice;
                bestDiscount = cheapest.discount;
                bestPriceFormatted = cheapest.price;
              }
            }
          }
          
          return {
            appid: game.appid,
            title: gameData.name,
            header_image: gameData.header_image,
            current_price: lowestCurrentPrice,
            original_price: lowestOriginalPrice,
            discount_percent: bestDiscount,
            price_formatted: bestPriceFormatted,
            genre: game.genre,
          };
        } catch (err) {
          console.log(`Error fetching game ${game.appid}:`, err);
          return null;
        }
      });

      // Aguarda todos os jogos carregarem em paralelo
      const results = await Promise.all(gamePromises);
      
      // Filtra jogos que carregaram com sucesso
      const validGames = results.filter((game): game is GameDeal => game !== null);
      
      setGames(validGames);
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

  // Lista de gêneros únicos
  const genres = ["Todos", ...Array.from(new Set(games.map(game => game.genre)))];

  // Filtra e ordena os jogos
  const filteredGames = games
    .filter(game =>
      game.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (selectedGenre === "Todos" || game.genre === selectedGenre)
    )
    .sort((a, b) => {
      if (sortBy === "discount") {
        return b.discount_percent - a.discount_percent;
      } else if (sortBy === "alphabetic") {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-foreground/10">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <NavigationDrawer />
            
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Procurar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 bg-muted/80 border-0 h-12"
              />
            </div>
            
            <button onClick={() => navigate("/settings")} className="p-2">
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
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="secondary"
                className="rounded-full px-6"
              >
                {selectedGenre}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2">
              <div className="space-y-1">
                {genres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenre(genre)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedGenre === genre
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
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
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((i) => (
              <div
                key={i}
                className="bg-card border-2 border-foreground rounded-xl p-3 flex gap-3 animate-pulse"
              >
                <div className="flex-shrink-0 w-32 h-20 bg-muted rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
                <div className="w-5 h-5 bg-muted rounded-full" />
              </div>
            ))}
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
                  onClick={(e) => toggleFavorite(game, e)}
                >
                  <Heart 
                    className={`w-5 h-5 transition-colors ${
                      favorites.has(game.appid) 
                        ? "fill-red-500 text-red-500" 
                        : "text-foreground hover:fill-current"
                    }`} 
                  />
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
