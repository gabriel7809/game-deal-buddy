import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, User, Heart, Home, Settings } from "lucide-react";

interface NavigationDrawerProps {
  children?: React.ReactNode;
}

export const NavigationDrawer = ({ children }: NavigationDrawerProps) => {
  const navigate = useNavigate();

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children || (
          <button className="p-2">
            <Menu className="w-6 h-6 text-foreground" />
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px]">
        <SheetHeader>
          <SheetTitle className="text-left">Menu</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 mt-6">
          <Button
            variant="ghost"
            className="justify-start gap-3 h-12"
            onClick={() => navigate("/")}
          >
            <Home className="w-5 h-5" />
            <span>Início</span>
          </Button>
          <Button
            variant="ghost"
            className="justify-start gap-3 h-12"
            onClick={() => navigate("/profile")}
          >
            <User className="w-5 h-5" />
            <span>Perfil</span>
          </Button>
          <Button
            variant="ghost"
            className="justify-start gap-3 h-12"
            onClick={() => navigate("/favorites")}
          >
            <Heart className="w-5 h-5" />
            <span>Favoritos</span>
          </Button>
          <Button
            variant="ghost"
            className="justify-start gap-3 h-12"
            onClick={() => navigate("/settings")}
          >
            <Settings className="w-5 h-5" />
            <span>Configurações</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
