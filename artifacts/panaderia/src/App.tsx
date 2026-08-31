import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/context/auth";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Productos from "@/pages/productos";
import Combos from "@/pages/combos";
import Ventas from "@/pages/ventas";
import Compras from "@/pages/compras";
import Proveedores from "@/pages/proveedores";
import Reportes from "@/pages/reportes";
import Camioneta from "@/pages/camioneta";
import Usuarios from "@/pages/usuarios";
import Perdidas from "@/pages/perdidas";
import Gastos from "@/pages/gastos";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

function AuthenticatedRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div className="max-w-sm space-y-2">
          <h1 className="text-lg font-semibold text-foreground">No se pudo abrir RegistroAM</h1>
          <p className="text-sm text-muted-foreground">
            No hay un usuario vendedor activo disponible. Revisá la conexión con el servidor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <ErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/productos" component={Productos} />
          <Route path="/combos" component={Combos} />
          <Route path="/ventas" component={Ventas} />
          <Route path="/compras" component={Compras} />
          <Route path="/proveedores" component={Proveedores} />
          <Route path="/reportes" component={Reportes} />
          <Route path="/camioneta" component={Camioneta} />
          <Route path="/usuarios" component={Usuarios} />
          <Route path="/perdidas" component={Perdidas} />
          <Route path="/gastos" component={Gastos} />
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthenticatedRouter />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
