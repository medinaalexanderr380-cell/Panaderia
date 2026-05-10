import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/context/auth";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Productos from "@/pages/productos";
import Ventas from "@/pages/ventas";
import Compras from "@/pages/compras";
import Proveedores from "@/pages/proveedores";
import Reportes from "@/pages/reportes";
import Camioneta from "@/pages/camioneta";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/productos" component={Productos} />
        <Route path="/ventas" component={Ventas} />
        <Route path="/compras" component={Compras} />
        <Route path="/proveedores" component={Proveedores} />
        <Route path="/reportes" component={Reportes} />
        <Route path="/camioneta" component={Camioneta} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
