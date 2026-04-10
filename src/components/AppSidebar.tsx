import { LayoutDashboard, Upload, Users, LogOut } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Upload Resume", url: "/upload", icon: Upload },
  { title: "Candidates", url: "/candidates", icon: Users },
];

export function AppSidebar() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    signOut();
    navigate("/", { replace: true });
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col justify-between z-50"
      style={{ width: 240, backgroundColor: "hsl(220, 76%, 15%)" }}
    >
      <div className="flex flex-col gap-1 p-4 pt-6">
        <span className="text-white font-bold text-lg mb-6 px-2">HireMind AI</span>
        {navItems.map((item) => {
          const active = location.pathname === item.url;
          return (
            <button
              key={item.title}
              onClick={() => navigate(item.url)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors w-full text-left ${
                active
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.title}</span>
            </button>
          );
        })}
      </div>
      <div className="p-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors w-full text-left"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
