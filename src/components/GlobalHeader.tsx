import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";

const GlobalHeader = () => {
  const { user } = useAuth();

  return (
    <nav className="border-b sticky top-0 bg-background/95 backdrop-blur z-50">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-3">
          <Logo className="h-10" />
          <div className="flex flex-col">
            <span className="font-semibold text-lg leading-tight text-foreground">HireMind AI</span>
            <span className="text-xs text-muted-foreground leading-tight">Hire smarter, not harder</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {!user && (
            <>
              <Link to="/login">
                <Button variant="ghost">Login</Button>
              </Link>
              <Link to="/register">
                <Button>Get Started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default GlobalHeader;
