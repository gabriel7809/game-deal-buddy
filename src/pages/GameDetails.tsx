import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ExternalLink, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GameInfo {
  title: string;
  steamAppID: string | null;
  thumb: string;
}

interface Deal {
  storeID: string;
  dealID: string;
  price: string;
  retailPrice: string;
  savings: string;
}

interface GameDetails {
  info: GameInfo;
  deals: Deal[];
  cheapestPriceEver: {
    price: string;
    date: number;
  };
}

interface Store {
  storeID: string;
  storeName: string;
  isActive: number;
  images: {
    banner: string;
    logo: string;
    icon: string;
  };
}

const GameDetails = () => {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    fetchGameDetails();
  }, [gameId]);

  const fetchGameDetails = async () => {
    if (!gameId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${gameId}&cc=br&l=pt`
      );
      const data = await response.json();
      
      if (data[gameId]?.success && data[gameId]?.data) {
        setGame(data[gameId].data);
      } else {
        toast({
          title: "Erro",
          description: "Jogo não encontrado",
          variant: "destructive",
        });
        navigate("/feed");
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível carregar os detalhes do jogo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getSteamUrl = () => {
    return `https://store.steampowered.com/app/${gameId}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <Skeleton className="h-8 w-8 mb-6" />
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/feed")}
            className="mb-6"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </Button>
          <p className="text-center text-muted-foreground">Jogo não encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Back Button */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-foreground/10">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/feed")}
            className="gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </Button>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6 pb-20">
        {/* Game Hero Section */}
        <div className="relative">
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-muted">
            <img
              src={game.header_image}
              alt={game.name}
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="mt-6 space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              {game.name}
            </h1>
            
            <p className="text-muted-foreground leading-relaxed">
              {game.short_description}
            </p>

            {/* Genres */}
            {game.genres && game.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {game.genres.map((genre: any) => (
                  <span
                    key={genre.id}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
                  >
                    {genre.description}
                  </span>
                ))}
              </div>
            )}

            {/* Developers and Publishers */}
            <div className="space-y-2 text-sm text-muted-foreground">
              {game.developers && game.developers.length > 0 && (
                <p>
                  <span className="font-semibold text-foreground">Desenvolvedora:</span>{" "}
                  {game.developers.join(", ")}
                </p>
              )}
              {game.publishers && game.publishers.length > 0 && (
                <p>
                  <span className="font-semibold text-foreground">Publicadora:</span>{" "}
                  {game.publishers.join(", ")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Price Section */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Preço na Steam
            </CardTitle>
          </CardHeader>
          <CardContent>
            {game.price_overview ? (
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    {game.price_overview.discount_percent > 0 ? (
                      <>
                        <div className="flex items-baseline gap-3">
                          <span className="text-sm text-muted-foreground line-through">
                            {game.price_overview.initial_formatted}
                          </span>
                          <span className="text-3xl font-bold text-green-600">
                            {game.price_overview.final_formatted}
                          </span>
                        </div>
                        <span className="inline-block px-3 py-1 bg-green-600 text-white rounded-full text-sm font-semibold">
                          -{game.price_overview.discount_percent}% OFF
                        </span>
                      </>
                    ) : (
                      <span className="text-3xl font-bold text-foreground">
                        {game.price_overview.final_formatted}
                      </span>
                    )}
                  </div>
                  <Button
                    size="lg"
                    onClick={() => window.open(getSteamUrl(), "_blank")}
                    className="gap-2 font-semibold"
                  >
                    Comprar na Steam
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">
                  {game.is_free ? "Este jogo é gratuito!" : "Preço não disponível"}
                </p>
                <Button
                  onClick={() => window.open(getSteamUrl(), "_blank")}
                  className="gap-2"
                >
                  {game.is_free ? "Baixar Grátis" : "Ver na Steam"}
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GameDetails;
