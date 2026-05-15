import { useQuery } from "@tanstack/react-query";
import {
  useObtenerResumen,
  getObtenerResumenQueryKey,
  useObtenerTopProductos,
  getObtenerTopProductosQueryKey,
  useObtenerStockBajo,
  getObtenerStockBajoQueryKey,
  useObtenerVentasPorDia,
  getObtenerVentasPorDiaQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/format";
import { AlertTriangle, TrendingUp, DollarSign, Package, ShoppingCart } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: resumen, isLoading: isLoadingResumen } = useObtenerResumen();
  const { data: topProductos, isLoading: isLoadingTop } = useObtenerTopProductos();
  const { data: stockBajo, isLoading: isLoadingStock } = useObtenerStockBajo();
  const { data: ventasPorDia, isLoading: isLoadingVentasDia } = useObtenerVentasPorDia({ dias: 7 });

  const isLoading = isLoadingResumen || isLoadingTop || isLoadingStock || isLoadingVentasDia;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[120px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Resumen General</h1>

      {stockBajo && stockBajo.length > 0 && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive-foreground">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Alerta de Inventario</AlertTitle>
          <AlertDescription>
            Hay {stockBajo.length} productos con stock por debajo del mínimo recomendado.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(resumen?.totalVentas ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {resumen?.cantidadVentas ?? 0} ventas registradas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inversión Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(resumen?.totalInvertido ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {resumen?.cantidadCompras ?? 0} compras realizadas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganancia Neta</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(resumen?.gananciaTotal ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Margen promedio: {formatNumber(resumen?.margenPromedio ?? 0)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Top</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topProductos?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Productos más vendidos
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Ventas de los últimos 7 días</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ventasPorDia ?? []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="fecha" 
                    tickFormatter={(val) => format(parseISO(val), 'dd MMM', { locale: es })}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tickFormatter={(val) => `$${val}`}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip 
                    formatter={(value: number) => [formatCurrency(value), "Ventas"]}
                    labelFormatter={(label) => format(parseISO(label as string), 'dd MMM yyyy', { locale: es })}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                  />
                  <Area type="monotone" dataKey="totalVentas" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorVentas)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProductos?.slice(0, 5).map((producto) => (
                <div key={producto.codigo} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{producto.nombre}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-bold">{formatCurrency(producto.ingresos)}</span>
                    <span className="text-xs text-muted-foreground">{producto.cantidadVendida} unid.</span>
                  </div>
                </div>
              ))}
              {!topProductos?.length && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No hay datos suficientes
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {stockBajo && stockBajo.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive">Atención a Inventario</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
              {stockBajo.map((producto) => (
                <div key={producto.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{producto.nombre}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <span className="text-sm text-destructive font-bold">{producto.stock} {producto.unidad}</span>
                      <span className="text-xs text-muted-foreground">Min: {producto.stockMinimo}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}