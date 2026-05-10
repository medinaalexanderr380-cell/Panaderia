import { Link, useLocation } from "wouter";
import {
  Store, ShoppingCart, Package, Users, BarChart, Truck, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const navigation = [
    { name: "Inicio", href: "/", icon: Store },
    { name: "Ventas", href: "/ventas", icon: ShoppingCart },
    { name: "Productos", href: "/productos", icon: Package },
    { name: "Compras", href: "/compras", icon: Truck },
    { name: "Camioneta", href: "/camioneta", icon: Truck },
    { name: "Proveedores", href: "/proveedores", icon: Users },
    { name: "Reportes", href: "/reportes", icon: BarChart },
  ];

  const mobileNav = [
    { name: "Inicio", href: "/", icon: Store },
    { name: "Ventas", href: "/ventas", icon: ShoppingCart },
    { name: "Camioneta", href: "/camioneta", icon: Truck },
    { name: "Productos", href: "/productos", icon: Package },
    { name: "Más", href: "/reportes", icon: BarChart },
  ];

  const handleLogout = async () => {
    await logout();
    toast({ title: "Sesión cerrada" });
  };

  return (
    <div className="min-h-screen bg-background font-sans">

      {/* ── DESKTOP: sidebar lateral ── */}
      <div className="hidden md:flex min-h-screen">
        <aside className="w-64 bg-sidebar border-r border-sidebar-border flex-shrink-0 flex flex-col">
          <div className="p-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Store className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold tracking-tight text-sidebar-foreground">
                Panadería Pro
              </span>
            </Link>
          </div>

          <nav className="px-4 space-y-1 flex-1">
            {navigation.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-sidebar-foreground/60")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User info + logout */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{user?.nombre?.charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.nombre}</p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">{user?.rol}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
            </Button>
          </div>
        </aside>

        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* ── MOBILE: header + contenido + barra inferior ── */}
      <div className="flex flex-col md:hidden min-h-screen">
        <header className="bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <Store className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">Panadería Pro</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-sidebar-foreground/60">{user?.nombre}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/60 hover:text-destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24">
          {children}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border">
          <div className="grid grid-cols-5 h-16">
            {mobileNav.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 transition-colors text-[10px] font-medium",
                    isActive ? "text-primary" : "text-sidebar-foreground/60"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-sidebar-foreground/50")} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
