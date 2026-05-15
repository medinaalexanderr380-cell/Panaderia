import { useQuery } from "@tanstack/react-query";
import { 
  useObtenerVentasPorDia, getObtenerVentasPorDiaQueryKey,
  useObtenerTopProductos, getObtenerTopProductosQueryKey,
  useObtenerReporteVendedores, getObtenerReporteVendedoresQueryKey,
  useObtenerResumen, getObtenerResumenQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Cell } from "recharts";
import { formatCurrency } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart as BarChartIcon, TrendingUp, Users, ChevronDown, ChevronUp, CalendarDays, Package } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface VendedorDetalle {
  vendedor: string;
  cantidadVentas: number;
  totalVentas: number;
  gananciaGenerada: number;
  hoy: { cantidadVentas: number; totalVentas: number; ganancia: number };
  topProductosGlobal: { nombre: string; cantidad: number; ingresos: number; ganancia: number }[];
  productosHoy: { nombre: string; cantidad: number; ingresos: number; ganancia: number }[];
}

export default function Reportes() {
  const { data: ventasMes } = useObtenerVentasPorDia({ dias: 30 }, { query: { queryKey: getObtenerVentasPorDiaQueryKey({ dias: 30 }) } });
  const { data: topProductos } = useObtenerTopProductos();
  const { data: vendedores } = useObtenerReporteVendedores();
  const { data: resumen } = useObtenerResumen();
  const { data: vendedoresDetalle } = useQuery<VendedorDetalle[]>({
    queryKey: ["reportes", "vendedores-detalle"],
    queryFn: () => fetch("/api/reportes/vendedores-detalle", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });
  const [expandido, setExpandido] = useState<string | null>(null);

  const chartColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
        <BarChartIcon className="w-8 h-8 text-primary" />
        Reportes y Analíticas
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary text-primary-foreground border-none">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <p className="text-primary-foreground/80 font-medium mb-2 uppercase tracking-wider text-xs">Margen de Ganancia Global</p>
            <div className="text-4xl font-bold">{resumen?.margenPromedio?.toFixed(1) || 0}%</div>
            <p className="text-sm mt-2 text-primary-foreground/80">
              Basado en ingresos vs. costos totales
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <p className="text-muted-foreground font-medium mb-2 uppercase tracking-wider text-xs">Ingresos Totales</p>
            <div className="text-3xl font-bold">{formatCurrency(resumen?.totalVentas || 0)}</div>
            <p className="text-sm mt-2 text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-primary" /> {resumen?.cantidadVentas || 0} ventas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <p className="text-muted-foreground font-medium mb-2 uppercase tracking-wider text-xs">Inversión (Compras)</p>
            <div className="text-3xl font-bold">{formatCurrency(resumen?.totalInvertido || 0)}</div>
            <p className="text-sm mt-2 text-muted-foreground">
              {resumen?.cantidadCompras || 0} órdenes de compra
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ventas" className="w-full">
        <TabsList className="grid w-full md:w-[400px] grid-cols-3">
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ventas" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Evolución de Ventas (30 Días)</CardTitle>
              <CardDescription>Ingresos vs Ganancia neta diaria</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ventasMes || []} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="fecha" 
                      tickFormatter={(val) => format(parseISO(val), 'dd MMM', { locale: es })}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      tickFormatter={(val) => `$${val/1000}k`}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dx={-10}
                    />
                    <RechartsTooltip 
                      formatter={(value: number, name: string) => [formatCurrency(value), name === 'totalVentas' ? 'Ingresos' : 'Ganancia']}
                      labelFormatter={(label) => format(parseISO(label as string), 'dd MMM yyyy', { locale: es })}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line type="monotone" dataKey="totalVentas" name="totalVentas" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="ganancia" name="ganancia" stroke="hsl(var(--chart-2))" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="productos" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Productos por Ingresos</CardTitle>
              <CardDescription>Los productos que generan mayor facturación</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductos?.slice(0, 10) || []} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" 
                      tickFormatter={(val) => `$${val/1000}k`}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis dataKey="nombre" type="category" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      width={90}
                    />
                    <RechartsTooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    />
                    <Bar dataKey="ingresos" name="Ingresos" radius={[0, 4, 4, 0]}>
                      {(topProductos?.slice(0, 10) || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipo" className="pt-6 space-y-4">
          {!vendedoresDetalle?.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No hay datos de vendedores aún.</CardContent></Card>
          ) : vendedoresDetalle.map(v => {
            const abierto = expandido === v.vendedor;
            const iniciales = v.vendedor.substring(0, 2).toUpperCase();
            return (
              <Card key={v.vendedor} className="overflow-hidden">
                {/* ── Cabecera del vendedor ── */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {iniciales}
                    </div>
                    <div>
                      <p className="font-semibold text-base capitalize">{v.vendedor}</p>
                      <p className="text-xs text-muted-foreground">{v.cantidadVentas} operaciones en total</p>
                    </div>
                  </div>

                  {/* ── Stats del día ── */}
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                      <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hoy — vendido</p>
                        <p className="font-bold text-sm text-primary">{formatCurrency(v.hoy.totalVentas)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <TrendingUp className="w-4 h-4 text-green-600 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hoy — ganancia</p>
                        <p className="font-bold text-sm text-green-700">{formatCurrency(v.hoy.ganancia)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                      <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Este mes — ganancia</p>
                        <p className="font-bold text-sm">{formatCurrency(v.gananciaGenerada)}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto shrink-0"
                    onClick={() => setExpandido(abierto ? null : v.vendedor)}
                  >
                    {abierto ? <><ChevronUp className="w-4 h-4" /> Ocultar</> : <><ChevronDown className="w-4 h-4" /> Ver productos</>}
                  </button>
                </div>

                {/* ── Detalle expandido ── */}
                {abierto && (
                  <div className="border-t grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                    {/* Hoy */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CalendarDays className="w-4 h-4 text-primary" />
                        <p className="font-semibold text-sm">Productos vendidos hoy</p>
                        {v.hoy.cantidadVentas > 0 && <Badge variant="secondary">{v.hoy.cantidadVentas} operac.</Badge>}
                      </div>
                      {v.productosHoy.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Sin ventas hoy</p>
                      ) : (
                        <div className="space-y-2">
                          {v.productosHoy.map(p => (
                            <div key={p.nombre} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{p.nombre}</p>
                                <p className="text-xs text-muted-foreground">{p.cantidad} unid. · ganancia: <span className="text-green-700 font-medium">{formatCurrency(p.ganancia)}</span></p>
                              </div>
                              <p className="font-bold ml-3 shrink-0">{formatCurrency(p.ingresos)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Top histórico */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <p className="font-semibold text-sm">Top productos histórico</p>
                      </div>
                      {v.topProductosGlobal.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Sin ventas registradas</p>
                      ) : (
                        <div className="space-y-2">
                          {v.topProductosGlobal.map((p, i) => (
                            <div key={p.nombre} className="flex items-center gap-3 text-sm p-2 rounded bg-muted/30">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{p.nombre}</p>
                                <p className="text-xs text-muted-foreground">{p.cantidad} unid. vendidas</p>
                              </div>
                              <p className="font-bold ml-2 shrink-0">{formatCurrency(p.ingresos)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}