import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StorePrice {
  store: string;
  price: string;
  originalPrice: string;
  discount: number;
  buyUrl: string;
  available: boolean;
}

const GameDetails = () => {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<any>(null);
  const [prices, setPrices] = useState<StorePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrices, setLoadingPrices] = useState(true);

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
    fetchPrices();
  }, [gameId]);

  const fetchGameDetails = async () => {
    if (!gameId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('fetch-steam-games', {
        body: { appid: gameId }
      });
      
      if (error) throw error;
      
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

  const fetchPrices = async () => {
    if (!gameId) return;

    try {
      setLoadingPrices(true);
      console.log('Fetching prices for game:', gameId);
      const { data, error } = await supabase.functions.invoke('fetch-game-prices', {
        body: { appid: gameId }
      });
      
      console.log('Prices response:', data);
      console.log('Prices error:', error);
      
      if (error) throw error;
      
      if (data?.prices) {
        console.log('Setting prices:', data.prices);
        setPrices(data.prices);
      } else {
        console.log('No prices in response');
      }
    } catch (error: any) {
      console.error("Error fetching prices:", error);
      toast({
        title: "Erro ao buscar preços",
        description: error.message || "Não foi possível carregar os preços",
        variant: "destructive",
      });
    } finally {
      setLoadingPrices(false);
    }
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
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </Button>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6 pb-20">
        {/* Game Image and Info Section */}
        <div className="grid md:grid-cols-[400px,1fr] gap-6">
          {/* Game Image */}
          <div className="relative">
            <div className="aspect-[460/215] w-full overflow-hidden rounded-xl bg-muted border-2 border-border">
              <img
                src={game.header_image}
                alt={game.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Game Information */}
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                {game.name}
              </h1>
              
              {/* Genres */}
              {game.genres && game.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
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
            </div>

            {/* Description */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Descrição</h2>
              <p className="text-muted-foreground leading-relaxed">
                {game.short_description}
              </p>
            </div>

            {/* Developers and Publishers */}
            <div className="space-y-2 text-sm">
              {game.developers && game.developers.length > 0 && (
                <p>
                  <span className="font-semibold text-foreground">Desenvolvedora:</span>{" "}
                  <span className="text-muted-foreground">{game.developers.join(", ")}</span>
                </p>
              )}
              {game.publishers && game.publishers.length > 0 && (
                <p>
                  <span className="font-semibold text-foreground">Publicadora:</span>{" "}
                  <span className="text-muted-foreground">{game.publishers.join(", ")}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Price Comparison Table */}
        <div className="bg-card border-2 border-border rounded-xl overflow-hidden">
          <div className="bg-primary/10 px-6 py-4 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">Comparação de Preços</h2>
            <p className="text-sm text-muted-foreground">Compare os preços em tempo real das principais lojas</p>
          </div>
          
          <div className="overflow-x-auto">
            {loadingPrices ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">Carregando preços...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">Loja</TableHead>
                    <TableHead className="font-bold">Preço Original</TableHead>
                    <TableHead className="font-bold">Preço Atual</TableHead>
                    <TableHead className="font-bold">Desconto</TableHead>
                    <TableHead className="font-bold text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prices.map((storePrice, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{storePrice.store}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {storePrice.originalPrice}
                      </TableCell>
                      <TableCell>
                        <span className={storePrice.discount > 0 ? "text-green-600 font-semibold" : ""}>
                          {storePrice.price}
                        </span>
                      </TableCell>
                      <TableCell>
                        {storePrice.discount > 0 && (
                          <span className="inline-block px-2 py-1 bg-green-600 text-white rounded-full text-xs font-semibold">
                            -{storePrice.discount}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => window.open(storePrice.buyUrl, "_blank")}
                          className="gap-2"
                          disabled={!storePrice.available && storePrice.price !== "Consultar"}
                        >
                          {storePrice.available ? "Comprar" : "Ver Loja"}
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameDetails;
