import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Gamepad2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const timer = setTimeout(() => {
        if (session) {
          navigate("/feed");
        } else {
          navigate("/auth");
        }
      }, 3000);

      return () => clearTimeout(timer);
    };

    checkAuthAndRedirect();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-center">
          <Gamepad2 className="w-24 h-24 text-primary" strokeWidth={1.5} />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-bold text-primary">
          Compare Preços de Jogos
        </h1>
        
        <p className="text-xl md:text-2xl text-foreground max-w-2xl mx-auto">
          Encontre os melhores preços para seus jogos favoritos!
        </p>
        
        <Button
          onClick={() => navigate("/auth")}
          size="lg"
          className="text-lg h-14 px-12 rounded-full font-bold"
        >
          Começar Agora
        </Button>
      </div>
    </div>
  );
};

export default Index;
