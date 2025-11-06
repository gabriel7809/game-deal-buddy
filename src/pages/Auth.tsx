import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { User, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido").max(255, "Email deve ter no máximo 255 caracteres"),
  password: z.string().min(1, "Senha é obrigatória"),
});

const signupSchema = z.object({
  email: z.string().email("Email inválido").max(255, "Email deve ter no máximo 255 caracteres"),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(72, "Senha deve ter no máximo 72 caracteres")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número"
    ),
  username: z
    .string()
    .min(3, "Nome de usuário deve ter no mínimo 3 caracteres")
    .max(30, "Nome de usuário deve ter no máximo 30 caracteres")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Nome de usuário pode conter apenas letras, números e sublinhados"
    ),
});

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/feed");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/feed");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Validate login inputs
        const validationResult = loginSchema.safeParse({ email, password });
        if (!validationResult.success) {
          const firstError = validationResult.error.errors[0];
          toast({
            title: "Erro de validação",
            description: firstError.message,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Login realizado!",
          description: "Bem-vindo de volta!",
        });
      } else {
        // Signup - validate password match first
        if (password !== confirmPassword) {
          toast({
            title: "Erro",
            description: "As senhas não coincidem",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        if (!acceptTerms) {
          toast({
            title: "Erro",
            description: "Você precisa aceitar os termos e condições",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Validate signup inputs
        const validationResult = signupSchema.safeParse({ email, password, username });
        if (!validationResult.success) {
          const firstError = validationResult.error.errors[0];
          toast({
            title: "Erro de validação",
            description: firstError.message,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              username: username,
            },
          },
        });

        if (error) throw error;

        toast({
          title: "Cadastro realizado!",
          description: "Sua conta foi criada com sucesso!",
        });
      }
    } catch (error: any) {
      // Generic error message to prevent account enumeration
      const errorMessage = error.message?.includes("Invalid login credentials")
        ? "Email ou senha incorretos"
        : "Ocorreu um erro. Tente novamente.";
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {isLogin ? (
        // Login Screen
        <div className="w-full max-w-md flex flex-col items-center space-y-8 animate-in fade-in duration-500">
          {/* Avatar */}
          <div className="w-40 h-40 rounded-full bg-card flex items-center justify-center shadow-lg">
            <User className="w-20 h-20 text-primary" strokeWidth={1.5} />
          </div>
          
          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-primary text-center px-4">
            Faça login para começar a usar nossa ferramenta!
          </h1>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-6">
            <Input
              type="email"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="text-lg"
              disabled={loading}
            />
            
            <Input
              type="password"
              placeholder="senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="text-lg"
              disabled={loading}
            />
            
            <div className="text-center space-y-2 pt-4">
              <p className="text-primary font-semibold">
                Não é cadastrado ainda?<br />
                Crie uma nova conta por aqui!
              </p>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className="text-primary font-bold text-lg underline hover:text-primary/80 transition-colors"
                disabled={loading}
              >
                Cadastrar!
              </button>
            </div>
            
            <Button
              type="submit"
              className="w-full h-14 text-lg font-bold rounded-full"
              size="lg"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>
      ) : (
        // Signup Screen
        <div className="w-full max-w-md animate-in fade-in duration-500">
          <button
            onClick={() => setIsLogin(true)}
            className="mb-6 text-primary hover:text-primary/80 transition-colors"
            disabled={loading}
          >
            <ArrowLeft className="w-8 h-8" />
          </button>
          
          <div className="bg-card rounded-3xl border-4 border-foreground p-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl md:text-3xl font-bold text-primary">
                Área de cadastro
              </h2>
              <p className="text-foreground">preencha seus dados de usuário</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                placeholder="nome de usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="text-base"
                disabled={loading}
              />
              
              <Input
                type="email"
                placeholder="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-base"
                disabled={loading}
              />
              
              <Input
                type="password"
                placeholder="senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-base"
                disabled={loading}
              />
              
              <Input
                type="password"
                placeholder="confirmar senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="text-base"
                disabled={loading}
              />
              
              <div className="flex items-center space-x-3 py-2">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                  className="border-2 border-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  disabled={loading}
                />
                <label htmlFor="terms" className="text-sm text-foreground cursor-pointer">
                  Eu li e aceito os termos e condições
                </label>
              </div>
              
              <Button
                type="submit"
                className="w-full h-14 text-lg font-bold rounded-full"
                size="lg"
                disabled={loading}
              >
                {loading ? "Finalizando..." : "Finalizar"}
              </Button>
            </form>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-primary font-semibold text-lg px-4">
              Realize compras de forma barata com nossas comparações de preços!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auth;
