import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Heart } from "lucide-react";
import { NavigationDrawer } from "@/components/NavigationDrawer";
import { toast } from "@/hooks/use-toast";

interface Favorite {
  id: string;
  appid: string;
  title: string;
  header_image: string;
  current_price: number;
  original_price: number;
  discount_percent: number;
  price_formatted: string;
  genre: string;
}

const Favorites = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    checkAuth();
    fetchFavorites();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("favorites")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setFavorites(data || []);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível carregar os favoritos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (favoriteId: string, title: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("id", favoriteId)
        .eq("user_id", user.id);

      if (error) throw error;

      setFavorites(prev => prev.filter(fav => fav.id !== favoriteId));

      toast({
        title: "Removido dos favoritos",
        description: `${title} foi removido dos seus favoritos`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível remover dos favoritos",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-foreground/10">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <NavigationDrawer />
            <h1 className="text-xl font-bold text-foreground">Favoritos</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">Carregando favoritos...</p>
          </div>
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 p-4 bg-muted rounded-full">
              <Heart className="w-12 h-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Nenhum favorito ainda
            </h2>
            <p className="text-muted-foreground mb-6">
              Comece adicionando jogos aos seus favoritos!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {favorites.map((game) => (
              <div
                key={game.id}
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

                {/* Remove Favorite Button */}
                <button 
                  className="self-start p-1 hover:scale-110 transition-transform"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFavorite(game.id, game.title);
                  }}
                >
                  <Heart className="w-5 h-5 fill-red-500 text-red-500 transition-colors" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;
