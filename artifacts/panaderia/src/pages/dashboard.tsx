import {
  useObtenerResumen,
  useObtenerTopProductos,
  useObtenerStockBajo,
  useObtenerVentasPorDia,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/format";
import { AlertTriangle, TrendingUp, DollarSign, Package, ShoppingCart, Truck, ArrowRight, ClipboardList, BarChart2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: resumen, isLoading: isLoadingResumen } = useObtenerResumen();
  const { data: topProductos, isLoading: isLoadingTop } = useObtenerTopProductos();
  const { data: stockBajo, isLoading: isLoadingStock } = useObtenerStockBajo();
  const { data: ventasPorDia, isLoading: isLoadingVentasDia } = useObtenerVentasPorDia({ dias: 7 });

  const isLoading = isLoadingResumen || isLoadingTop || isLoadingStock || isLoadingVentasDia;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Resumen General</h1>
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

  const sinDatos = !resumen?.cantidadVentas && !resumen?.cantidadCompras;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Resumen General</h1>

      {stockBajo && stockBajo.length > 0 && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Alerta de Inventario</AlertTitle>
          <AlertDescription>
            Hay {stockBajo.length} {stockBajo.length === 1 ? "producto" : "productos"} con stock por debajo del mínimo.
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
              {resumen?.cantidadVentas ?? 0} ventas este mes
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
              {topProductos?.length ? "Más vendidos este mes" : "Sin ventas aún"}
            </p>
          </CardContent>
        </Card>
      </div>

      {sinDatos ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              ¡Bienvenido a RegistroAM! — Primeros pasos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { paso: "1", titulo: "Cargá tus productos", desc: "Agregá los productos que manejás con su precio de costo y venta.", href: "/productos", icon: Package },
                { paso: "2", titulo: "Registrá una compra", desc: "Cada vez que comprás mercadería, registrala en Compras.", href: "/compras", icon: Truck },
                { paso: "3", titulo: "Cargá las camionetas", desc: "Asigná stock a la camioneta de Michel o David antes de salir.", href: "/camioneta", icon: Truck },
                { paso: "4", titulo: "Registrá tus ventas", desc: "Al volver, registrá lo vendido en ruta o desde la panadería.", href: "/ventas", icon: ShoppingCart },
              ].map(({ paso, titulo, desc, href, icon: Icon }) => (
                <Link key={paso} href={href}>
                  <div className="group flex flex-col gap-2 p-4 rounded-lg border bg-background hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer h-full">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">{paso}</span>
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="font-semibold text-sm">{titulo}</p>
                    <p className="text-xs text-muted-foreground flex-1">{desc}</p>
                    <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Ir <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Ventas de los últimos 7 días</CardTitle>
            </CardHeader>
            <CardContent className="pl-0">
              {!ventasPorDia?.length ? (
                <div className="h-[300px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <BarChart2 className="w-12 h-12 opacity-20" />
                  <p className="text-sm">No hay ventas en los últimos 7 días</p>
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ventasPorDia} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                        fontSize={12} tickLine={false} axisLine={false}
                      />
                      <YAxis
                        tickFormatter={(val) => `$${val}`}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12} tickLine={false} axisLine={false}
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
              )}
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Top Productos</CardTitle>
            </CardHeader>
            <CardContent>
              {!topProductos?.length ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                  <ShoppingCart className="w-10 h-10 opacity-20" />
                  <p className="text-sm text-center">Registrá ventas para ver los productos más vendidos</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {topProductos.slice(0, 5).map((producto) => (
                    <div key={producto.codigo} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{producto.nombre}</span>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold">{formatCurrency(producto.ingresos)}</span>
                        <span className="text-xs text-muted-foreground">{producto.cantidadVendida} unid.</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {stockBajo && stockBajo.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Stock Bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stockBajo.map((producto) => (
                <div key={producto.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium">{producto.nombre}</span>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-sm text-destructive font-bold">{producto.stock} {producto.unidad}</span>
                    <span className="text-xs text-muted-foreground">mín. {producto.stockMinimo}</span>
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
