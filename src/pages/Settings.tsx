import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const Settings = () => {
  const navigate = useNavigate();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [language, setLanguage] = useState("pt-BR");
  const [currency, setCurrency] = useState("BRL");

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso",
      });
      navigate("/auth");
    } catch (error: any) {
      toast({
        title: "Erro ao deslogar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleNotificationToggle = (checked: boolean) => {
    setNotificationsEnabled(checked);
    toast({
      title: checked ? "Notificações ativadas" : "Notificações desativadas",
      description: checked 
        ? "Você receberá notificações sobre ofertas" 
        : "Você não receberá mais notificações",
    });
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    toast({
      title: "Idioma alterado",
      description: `Idioma alterado para ${value === "pt-BR" ? "Português (BR)" : value === "en-US" ? "Inglês (EUA)" : "Espanhol"}`,
    });
  };

  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
    toast({
      title: "Moeda alterada",
      description: `Moeda de precificação alterada para ${value}`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-foreground/10">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2">
              <ArrowLeft className="w-6 h-6 text-foreground" />
            </button>
            <h1 className="text-xl font-bold text-foreground">Configurações</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Notifications Section */}
        <div className="bg-card border-2 border-foreground rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="notifications" className="text-base font-semibold text-foreground">
                Notificações
              </Label>
              <p className="text-sm text-muted-foreground">
                Receba alertas sobre ofertas e descontos
              </p>
            </div>
            <Switch
              id="notifications"
              checked={notificationsEnabled}
              onCheckedChange={handleNotificationToggle}
            />
          </div>
        </div>

        {/* Language Section */}
        <div className="bg-card border-2 border-foreground rounded-xl p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language" className="text-base font-semibold text-foreground">
              Idioma
            </Label>
            <p className="text-sm text-muted-foreground mb-3">
              Escolha o idioma do aplicativo
            </p>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger id="language" className="w-full">
                <SelectValue placeholder="Selecione o idioma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                <SelectItem value="en-US">English (USA)</SelectItem>
                <SelectItem value="es-ES">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Currency Section */}
        <div className="bg-card border-2 border-foreground rounded-xl p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currency" className="text-base font-semibold text-foreground">
              Região de Precificação
            </Label>
            <p className="text-sm text-muted-foreground mb-3">
              Escolha a moeda para exibição de preços
            </p>
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger id="currency" className="w-full">
                <SelectValue placeholder="Selecione a moeda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">Real Brasileiro (R$)</SelectItem>
                <SelectItem value="USD">Dólar Americano (US$)</SelectItem>
                <SelectItem value="EUR">Euro (€)</SelectItem>
                <SelectItem value="GBP">Libra Esterlina (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Logout Section */}
        <div className="bg-card border-2 border-foreground rounded-xl p-6">
          <Button
            onClick={handleLogout}
            variant="destructive"
            className="w-full"
            size="lg"
          >
            <LogOut className="mr-2 h-5 w-5" />
            Sair da Conta
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
