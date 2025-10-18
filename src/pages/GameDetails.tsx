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
  const [game, setGame] = useState<GameDetails | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState(5.5); // BRL exchange rate

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
    fetchStores();
    fetchExchangeRate();
  }, [gameId]);

  const fetchExchangeRate = async () => {
    try {
      const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
      const data = await response.json();
      if (data.rates && data.rates.BRL) {
        setExchangeRate(data.rates.BRL);
      }
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      // Keep default rate if fetch fails
    }
  };

  const fetchStores = async () => {
    try {
      const response = await fetch("https://www.cheapshark.com/api/1.0/stores");
      const data = await response.json();
      setStores(data);
    } catch (error) {
      console.error("Error fetching stores:", error);
    }
  };

  const fetchGameDetails = async () => {
    if (!gameId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `https://www.cheapshark.com/api/1.0/games?id=${gameId}`
      );
      const data = await response.json();
      setGame(data);
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

  const getStoreName = (storeID: string) => {
    const store = stores.find((s) => s.storeID === storeID);
    return store?.storeName || `Loja ${storeID}`;
  };

  const getDealUrl = (storeID: string, dealID: string) => {
    return `https://www.cheapshark.com/redirect?dealID=${dealID}`;
  };

  const convertToBRL = (usdPrice: string) => {
    return (parseFloat(usdPrice) * exchangeRate).toFixed(2);
  };

  const getBestDeal = () => {
    if (!game?.deals || game.deals.length === 0) return null;
    return game.deals.reduce((prev, current) => 
      parseFloat(current.price) < parseFloat(prev.price) ? current : prev
    );
  };

  const bestDeal = getBestDeal();

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
              src={game.info.thumb}
              alt={game.info.title}
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="mt-6 space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              {game.info.title}
            </h1>
            
            {game.info.steamAppID && (
              <p className="text-sm text-muted-foreground">
                Steam App ID: {game.info.steamAppID}
              </p>
            )}
          </div>
        </div>

        {/* Best Deal Card */}
        {bestDeal && (
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-primary">
                <TrendingDown className="w-5 h-5" />
                Melhor Oferta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {getStoreName(bestDeal.storeID)}
                  </p>
                  <div className="flex items-baseline gap-3">
                    {parseFloat(bestDeal.savings) > 0 && (
                      <span className="text-sm text-muted-foreground line-through">
                        R$ {convertToBRL(bestDeal.retailPrice)}
                      </span>
                    )}
                    <span className="text-3xl font-bold text-green-600">
                      R$ {convertToBRL(bestDeal.price)}
                    </span>
                  </div>
                  {parseFloat(bestDeal.savings) > 0 && (
                    <span className="inline-block px-3 py-1 bg-green-600 text-white rounded-full text-sm font-semibold">
                      {parseFloat(bestDeal.savings).toFixed(0)}% OFF
                    </span>
                  )}
                </div>
                <Button
                  size="lg"
                  onClick={() => window.open(getDealUrl(bestDeal.storeID, bestDeal.dealID), "_blank")}
                  className="gap-2 font-semibold"
                >
                  Comprar Agora
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Stores Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Todas as Lojas</CardTitle>
          </CardHeader>
          <CardContent>
            {game.deals.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma oferta disponível no momento
              </p>
            ) : (
              <div className="space-y-3">
                {game.deals.map((deal) => (
                  <div
                    key={deal.dealID}
                    className="flex items-center justify-between p-4 rounded-xl border-2 border-foreground/10 hover:border-primary/30 transition-all hover:shadow-sm"
                  >
                    <div className="flex-1 space-y-1">
                      <p className="font-semibold text-foreground">
                        {getStoreName(deal.storeID)}
                      </p>
                      <div className="flex items-center gap-3">
                        {parseFloat(deal.savings) > 0 && (
                          <span className="text-sm text-muted-foreground line-through">
                            R$ {convertToBRL(deal.retailPrice)}
                          </span>
                        )}
                        <span className="text-xl font-bold text-green-600">
                          R$ {convertToBRL(deal.price)}
                        </span>
                        {parseFloat(deal.savings) > 0 && (
                          <span className="px-2 py-0.5 bg-green-600/10 text-green-600 rounded-full text-xs font-semibold">
                            -{parseFloat(deal.savings).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => window.open(getDealUrl(deal.storeID, deal.dealID), "_blank")}
                      className="gap-2"
                    >
                      Ver Oferta
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GameDetails;
