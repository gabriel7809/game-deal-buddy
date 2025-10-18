import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

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
  }, [gameId]);

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
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/feed")}
          className="mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Voltar
        </Button>

        {/* Game Header */}
        <div className="space-y-4">
          <img
            src={game.info.thumb}
            alt={game.info.title}
            className="w-full h-64 object-cover rounded-xl shadow-lg"
          />
          
          <h1 className="text-3xl font-bold text-foreground">
            {game.info.title}
          </h1>

          {game.info.steamAppID && (
            <p className="text-sm text-muted-foreground">
              Steam App ID: {game.info.steamAppID}
            </p>
          )}
        </div>

        {/* Price Comparison Table */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">
            Comparação de Preços
          </h2>

          <div className="bg-card border-2 border-foreground rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Loja
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Preço Normal
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Preço Atual
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Desconto
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {game.deals.map((deal) => (
                    <tr key={deal.dealID} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {getStoreName(deal.storeID)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground line-through">
                        R$ {parseFloat(deal.retailPrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">
                        R$ {parseFloat(deal.price).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {parseFloat(deal.savings) > 0 ? (
                          <span className="inline-block px-2 py-1 bg-green-600 text-white rounded-full text-xs font-semibold">
                            -{parseFloat(deal.savings).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          onClick={() => window.open(getDealUrl(deal.storeID, deal.dealID), "_blank")}
                          className="gap-2"
                        >
                          Comprar
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {game.deals.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma oferta disponível no momento
            </p>
          )}
        </div>

        {/* Best Price Highlight */}
        {game.deals.length > 0 && (
          <div className="bg-primary/10 border-2 border-primary rounded-xl p-4">
            <h3 className="text-lg font-bold text-primary mb-2">
              Melhor Preço
            </h3>
            <p className="text-foreground">
              {getStoreName(game.deals[0].storeID)} - R$ {parseFloat(game.deals[0].price).toFixed(2)}
              {parseFloat(game.deals[0].savings) > 0 && (
                <span className="ml-2 text-green-600 font-semibold">
                  ({parseFloat(game.deals[0].savings).toFixed(0)}% OFF)
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameDetails;
