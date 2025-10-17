import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Menu, Settings, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface GameDeal {
  dealID: string;
  title: string;
  thumb: string;
  salePrice: string;
  normalPrice: string;
  savings: string;
  storeID: string;
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
      // CheapShark API - Get top deals (sorted by descending price savings)
      const response = await fetch(
        "https://www.cheapshark.com/api/1.0/deals?storeID=1&upperPrice=50&pageSize=20&sortBy=Savings"
      );
      
      if (!response.ok) throw new Error("Erro ao buscar jogos");
      
      const data = await response.json();
      setGames(data);
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
        ) : (
          <div className="space-y-4">
            {filteredGames.map((game) => (
              <div
                key={game.dealID}
                className="bg-card border-2 border-foreground rounded-2xl p-4 flex gap-4 hover:shadow-lg transition-shadow animate-in fade-in duration-300"
              >
                {/* Game Image */}
                <div className="flex-shrink-0">
                  <img
                    src={game.thumb}
                    alt={game.title}
                    className="w-32 h-32 object-cover rounded-xl"
                  />
                </div>

                {/* Game Info */}
                <div className="flex-1 space-y-2">
                  <h3 className="text-lg font-bold text-foreground line-clamp-2">
                    {game.title}
                  </h3>
                  
                  <div className="space-y-1 text-sm">
                    <p className="text-foreground">
                      <span className="font-semibold">Maior preço:</span>{" "}
                      R$ {parseFloat(game.normalPrice).toFixed(2)}
                    </p>
                    <p className="text-foreground">
                      <span className="font-semibold">Menor preço:</span>{" "}
                      <span className="text-green-600 font-bold">
                        R$ {parseFloat(game.salePrice).toFixed(2)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Economia de {parseFloat(game.savings).toFixed(0)}%
                    </p>
                  </div>
                </div>

                {/* Favorite Button */}
                <button className="self-start p-2">
                  <Heart className="w-6 h-6 text-foreground hover:fill-current transition-colors" />
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
