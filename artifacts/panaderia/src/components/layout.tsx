import { Link, useLocation } from "wouter";
import {
  Store, ShoppingCart, Package, Users, BarChart, Truck, ShieldCheck, AlertTriangle, ShoppingBag, Receipt,
  WifiOff, Loader2, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/auth";

interface LayoutProps {
  children: React.ReactNode;
}

type ServerStatus = "ok" | "starting" | "offline";

function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>("ok");
  const [showBanner, setShowBanner] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/healthz", { cache: "no-store" });
        if (!cancelled) {
          if (res.ok) {
            if (status !== "ok") {
              setStatus("ok");
              // Show "volvió" banner briefly then hide
              setShowBanner(true);
              hideTimer.current = setTimeout(() => setShowBanner(false), 3000);
            } else {
              setShowBanner(false);
            }
          } else {
            setStatus("starting");
            setShowBanner(true);
          }
        }
      } catch {
        if (!cancelled) {
          setStatus("offline");
          setShowBanner(true);
        }
      }
    };

    check();
    const interval = setInterval(check, 10000);
    return () => { cancelled = true; clearInterval(interval); if (hideTimer.current) clearTimeout(hideTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, showBanner };
}

function ServerBanner({ status, showBanner }: { status: ServerStatus; showBanner: boolean }) {
  if (!showBanner) return null;

  if (status === "ok") {
    return (
      <div className="w-full bg-green-600 text-white text-sm py-2 px-4 flex items-center justify-center gap-2 z-50">
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        Servidor conectado — ya podés usar la app normalmente
      </div>
    );
  }

  return (
    <div className="w-full bg-amber-500 text-white text-sm py-2 px-4 flex items-center justify-center gap-2 z-50">
      {status === "starting"
        ? <><Loader2 className="w-4 h-4 animate-spin" /> El servidor está iniciando, por favor esperá unos segundos…</>
        : <><WifiOff className="w-4 h-4" /> Sin conexión al servidor — intentando reconectar…</>
      }
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { status, showBanner } = useServerStatus();
  const { user } = useAuth();

  const mainNav = [
    { name: "Inicio", href: "/", icon: Store },
    { name: "Ventas", href: "/ventas", icon: ShoppingCart },
    { name: "Productos", href: "/productos", icon: Package },
    { name: "Combos", href: "/combos", icon: Layers },
    { name: "Compras", href: "/compras", icon: ShoppingBag },
    { name: "Camioneta", href: "/camioneta", icon: Truck },
    { name: "Proveedores", href: "/proveedores", icon: Users },
    { name: "Reportes", href: "/reportes", icon: BarChart },
    { name: "Gastos", href: "/gastos", icon: Receipt },
    { name: "Pérdidas", href: "/perdidas", icon: AlertTriangle },
  ];

  const adminNav = [
    { name: "Usuarios", href: "/usuarios", icon: ShieldCheck },
  ];

  const mobileNav = [
    { name: "Inicio", href: "/", icon: Store },
    { name: "Ventas", href: "/ventas", icon: ShoppingCart },
    { name: "Combos", href: "/combos", icon: Layers },
    { name: "Camioneta", href: "/camioneta", icon: Truck },
    { name: "Compras", href: "/compras", icon: ShoppingBag },
    { name: "Pérdidas", href: "/perdidas", icon: AlertTriangle },
  ];

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <ServerBanner status={status} showBanner={showBanner} />

      {/* ── DESKTOP: sidebar lateral ── */}
      <div className="hidden md:flex flex-1">
        <aside className="w-64 bg-sidebar border-r border-sidebar-border flex-shrink-0 flex flex-col">
          <div className="p-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Store className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold tracking-tight text-sidebar-foreground">
                RegistroAM
              </span>
            </Link>
          </div>

          <nav className="px-4 flex-1 flex flex-col">
            <div className="space-y-1 flex-1">
              {mainNav.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium",
                    isActive(item.href)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive(item.href) ? "text-primary" : "text-sidebar-foreground/60")} />
                  {item.name}
                </Link>
              ))}
            </div>

            <div className="border-t border-sidebar-border pt-3 pb-4 mt-4 space-y-1">
              {user?.rol === "admin" && adminNav.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium",
                    isActive(item.href)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive(item.href) ? "text-primary" : "text-sidebar-foreground/40")} />
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="p-4 border-t border-sidebar-border">
              <div className="flex items-center gap-3 mb-3 px-1">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{user?.nombre?.charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.nombre}</p>
                  <p className="text-xs text-sidebar-foreground/60 capitalize">{user?.rol === "admin" ? "Administrador" : "Vendedor"}</p>
                </div>
              </div>
            </div>
          </nav>
        </aside>

        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* ── MOBILE: header + contenido + barra inferior ── */}
      <div className="flex flex-col md:hidden flex-1">
        <header className="bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <Store className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">RegistroAM</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-sidebar-foreground/60">{user?.nombre}</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24">
          {children}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border">
          <div className="grid grid-cols-6 h-16">
            {mobileNav.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 transition-colors text-[10px] font-medium",
                  isActive(item.href) ? "text-primary" : "text-sidebar-foreground/60"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive(item.href) ? "text-primary" : "text-sidebar-foreground/50")} />
                <span>{item.name}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
