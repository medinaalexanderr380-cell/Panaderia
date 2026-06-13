import { useQuery } from "@tanstack/react-query";
import { 
  useObtenerVentasPorDia, getObtenerVentasPorDiaQueryKey,
  useObtenerTopProductos,
  useObtenerReporteVendedores,
  useObtenerResumen,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart as BarChartIcon, TrendingUp, Users, ChevronDown, ChevronUp, CalendarDays, Package, ShoppingBag, Truck, Download, FileSpreadsheet, Receipt } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface VendedorDetalle {
  vendedor: string;
  cantidadVentas: number;
  totalVentas: number;
  gananciaGenerada: number;
  costoMes: number;
  hoy: { cantidadVentas: number; totalVentas: number; ganancia: number; costo: number };
  topProductosGlobal: { nombre: string; cantidad: number; ingresos: number; ganancia: number }[];
  productosHoy: { nombre: string; cantidad: number; ingresos: number; ganancia: number }[];
}

interface ProveedorDetalle {
  proveedorId: number | null;
  proveedorNombre: string;
  costoTotal: number;
  ingresos: number;
  ganancia: number;
  productos: { codigo: string; nombre: string; cantidad: number; costoTotal: number; ingresos: number; ganancia: number }[];
}

interface ProveedorPorDia {
  proveedorNombre: string;
  costoTotal: number;
  ingresos: number;
  ganancia: number;
  productos: { nombre: string; cantidad: number; costoTotal: number; ingresos: number; ganancia: number }[];
}
interface DiaPorProveedor {
  fecha: string;
  totalVendido: number;
  totalCosto: number;
  totalGanancia: number;
  totalGastos: number;
  gananciaReal: number;
  gastos: { id: number; descripcion: string; monto: number }[];
  proveedores: ProveedorPorDia[];
}

interface CierreMes {
  mes: string;
  totalVentas: number;
  totalGanancia: number;
  totalCosto: number;
  cantidadVentas: number;
  porProveedor: { proveedorNombre: string; costoTotal: number; ingresos: number; ganancia: number; productos: { nombre: string; cantidad: number; costoTotal: number; ingresos: number; ganancia: number }[] }[];
  porVendedor: { vendedor: string; totalVentas: number; ganancia: number; costoTotal: number; cantidadVentas: number }[];
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
  const { data: porProveedor } = useQuery<ProveedorDetalle[]>({
    queryKey: ["reportes", "por-proveedor"],
    queryFn: () => fetch("/api/reportes/por-proveedor", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });
  const { data: cierreMes } = useQuery<CierreMes>({
    queryKey: ["reportes", "cierre-mes"],
    queryFn: () => fetch("/api/reportes/cierre-mes", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });
  const { data: porDia } = useQuery<DiaPorProveedor[]>({
    queryKey: ["reportes", "proveedores-por-dia"],
    queryFn: () => fetch("/api/reportes/proveedores-por-dia", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const [expandido, setExpandido] = useState<string | null>(null);
  const [expandidoProv, setExpandidoProv] = useState<string | null>(null);
  const [expandidoCierre, setExpandidoCierre] = useState(false);
  const [expandidoDia, setExpandidoDia] = useState<string | null>(null);
  const [expandidoDiaProv, setExpandidoDiaProv] = useState<string | null>(null);

  const descargarCierreMes = () => {
    const a = document.createElement("a");
    a.href = "/api/reportes/cierre-mes/exportar";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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

      {/* ── Cierre de Mes ── */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-bold text-base">Cierre de Mes</p>
              <p className="text-xs text-muted-foreground capitalize">{cierreMes?.mes ?? "Calculando..."} · {cierreMes?.cantidadVentas ?? 0} ventas</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total vendido</p>
                <p className="font-bold text-sm text-primary">{formatCurrency(cierreMes?.totalVentas ?? 0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
              <ShoppingBag className="w-4 h-4 text-orange-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total costo</p>
                <p className="font-bold text-sm text-orange-700">{formatCurrency(cierreMes?.totalCosto ?? 0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <TrendingUp className="w-4 h-4 text-green-600 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ganancia neta</p>
                <p className="font-bold text-sm text-green-700">{formatCurrency(cierreMes?.totalGanancia ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setExpandidoCierre(v => !v)}
            >
              {expandidoCierre ? <><ChevronUp className="w-4 h-4" /> Ocultar</> : <><ChevronDown className="w-4 h-4" /> Ver detalle</>}
            </button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={descargarCierreMes}>
              <Download className="w-3.5 h-3.5" /> Descargar CSV
            </Button>
          </div>
        </div>

        {expandidoCierre && cierreMes && (
          <div className="border-t grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
            {/* Por vendedor */}
            <div className="p-4">
              <p className="font-semibold text-sm mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Por vendedor</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Ventas</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right">Ganancia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cierreMes.porVendedor.map(v => (
                      <TableRow key={v.vendedor}>
                        <TableCell className="font-medium capitalize">{v.vendedor}</TableCell>
                        <TableCell className="text-right">{formatCurrency(v.totalVentas)}</TableCell>
                        <TableCell className="text-right text-orange-700">{formatCurrency(v.costoTotal)}</TableCell>
                        <TableCell className="text-right text-green-700 font-bold">{formatCurrency(v.ganancia)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            {/* Por proveedor */}
            <div className="p-4">
              <p className="font-semibold text-sm mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-amber-600" /> A pagar por proveedor</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">A pagarle</TableHead>
                      <TableHead className="text-right">Me queda</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cierreMes.porProveedor.map(p => (
                      <TableRow key={p.proveedorNombre}>
                        <TableCell className="font-medium">{p.proveedorNombre}</TableCell>
                        <TableCell className="text-right text-red-700 font-bold">{formatCurrency(p.costoTotal)}</TableCell>
                        <TableCell className="text-right text-green-700 font-bold">{formatCurrency(p.ganancia)}</TableCell>
                      </TableRow>
                    ))}
                    {cierreMes.porProveedor.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sin datos</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Tabs defaultValue="ventas" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
          <TabsTrigger value="pordia">Por Día</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ventas" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Evolución de Ventas (30 Días)</CardTitle>
              <CardDescription>Ingresos vs Ganancia neta diaria</CardDescription>
            </CardHeader>
            <CardContent>
              {ventasMes && ventasMes.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={ventasMes}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" tickFormatter={f => { try { return format(parseISO(f), "d MMM", { locale: es }); } catch { return f; } }} />
                    <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={l => { try { return format(parseISO(l as string), "EEEE d MMM", { locale: es }); } catch { return l; } }} />
                    <Legend />
                    <Line type="monotone" dataKey="totalVentas" name="Ingresos" stroke={chartColors[0]} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ganancia" name="Ganancia" stroke={chartColors[1]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Sin datos de ventas aún</div>
              )}
            </CardContent>
          </Card>

          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumen por Día</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Ventas</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                      <TableHead className="text-right">Ganancia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!ventasMes || ventasMes.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sin registros</TableCell></TableRow>
                    ) : [...ventasMes].reverse().map(d => (
                      <TableRow key={d.fecha}>
                        <TableCell className="font-medium">{(() => { try { return format(parseISO(d.fecha), "EEEE d MMM yyyy", { locale: es }); } catch { return d.fecha; } })()}</TableCell>
                        <TableCell className="text-right">{d.cantidadVentas}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(d.totalVentas)}</TableCell>
                        <TableCell className="text-right text-green-700 font-medium">{formatCurrency(d.ganancia)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="productos" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Productos</CardTitle>
              <CardDescription>Los más vendidos del período</CardDescription>
            </CardHeader>
            <CardContent>
              {topProductos && topProductos.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topProductos.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nombre" width={120} tick={{ fontSize: 12 }} />
                    <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="ingresos" name="Ingresos" fill={chartColors[0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Sin datos de productos aún</div>
              )}
            </CardContent>
          </Card>

          <div className="mt-6">
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Unidades</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                      <TableHead className="text-right">Ganancia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!topProductos || topProductos.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin registros</TableCell></TableRow>
                    ) : topProductos.map((p, i) => (
                      <TableRow key={p.codigo}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{p.nombre}</TableCell>
                        <TableCell className="text-right">{p.cantidadVendida}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.ingresos)}</TableCell>
                        <TableCell className="text-right text-green-700 font-medium">{formatCurrency(p.ganancia)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="equipo" className="pt-6 space-y-4">
          {!vendedoresDetalle || vendedoresDetalle.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Sin ventas registradas aún</CardContent></Card>
          ) : vendedoresDetalle.map(v => {
            const abierto = expandido === v.vendedor;
            const iniciales = v.vendedor.substring(0, 2).toUpperCase();
            return (
              <Card key={v.vendedor} className="overflow-hidden">
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {iniciales}
                    </div>
                    <div>
                      <p className="font-semibold text-base capitalize">{v.vendedor}</p>
                      <p className="text-xs text-muted-foreground">{v.cantidadVentas} operaciones este mes</p>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {/* Hoy vendido */}
                    <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                      <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hoy — vendido</p>
                        <p className="font-bold text-sm text-primary">{formatCurrency(v.hoy.totalVentas)}</p>
                      </div>
                    </div>
                    {/* Hoy costo */}
                    <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                      <ShoppingBag className="w-4 h-4 text-orange-500 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hoy — costo</p>
                        <p className="font-bold text-sm text-orange-700">{formatCurrency(v.hoy.costo)}</p>
                      </div>
                    </div>
                    {/* Hoy ganancia */}
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <TrendingUp className="w-4 h-4 text-green-600 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hoy — ganancia</p>
                        <p className="font-bold text-sm text-green-700">{formatCurrency(v.hoy.ganancia)}</p>
                      </div>
                    </div>
                    {/* Mes ganancia */}
                    <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                      <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Este mes — ganancia</p>
                        <p className="font-bold text-sm">{formatCurrency(v.gananciaGenerada)}</p>
                      </div>
                    </div>
                    {/* Mes costo */}
                    <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                      <ShoppingBag className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Este mes — costo</p>
                        <p className="font-bold text-sm text-orange-700">{formatCurrency(v.costoMes)}</p>
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

                {abierto && (
                  <div className="border-t grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
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
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <p className="font-semibold text-sm">Top productos este mes</p>
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

        <TabsContent value="proveedores" className="pt-6 space-y-6">

          {/* ── Historial por día ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" /> Historial por día
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!porDia || porDia.length === 0 ? (
                <p className="px-6 pb-5 text-sm text-muted-foreground">Sin ventas registradas en los últimos 30 días</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Día</TableHead>
                        <TableHead className="text-right">Vendí</TableHead>
                        <TableHead className="text-right">Costo a pagar</TableHead>
                        <TableHead className="text-right">Mi ganancia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porDia.map(dia => {
                        const fechaLabel = (() => {
                          try { return format(parseISO(dia.fecha), "EEE d/MM", { locale: es }); } catch { return dia.fecha; }
                        })();
                        return (
                          <TableRow key={dia.fecha}>
                            <TableCell className="font-medium capitalize">{fechaLabel}</TableCell>
                            <TableCell className="text-right font-semibold text-primary">{formatCurrency(dia.totalVendido)}</TableCell>
                            <TableCell className="text-right font-semibold text-red-700">{formatCurrency(dia.totalCosto)}</TableCell>
                            <TableCell className="text-right font-bold text-green-700">{formatCurrency(dia.totalGanancia)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Fila de totales */}
                      <TableRow className="bg-muted/40 font-bold border-t-2">
                        <TableCell>TOTAL ({porDia.length} días)</TableCell>
                        <TableCell className="text-right text-primary">
                          {formatCurrency(porDia.reduce((s, d) => s + d.totalVendido, 0))}
                        </TableCell>
                        <TableCell className="text-right text-red-700">
                          {formatCurrency(porDia.reduce((s, d) => s + d.totalCosto, 0))}
                        </TableCell>
                        <TableCell className="text-right text-green-700">
                          {formatCurrency(porDia.reduce((s, d) => s + d.totalGanancia, 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Detalle por proveedor (mes actual) ── */}
          <div>
            <p className="text-sm text-muted-foreground mb-4">Desglose mensual por proveedor — cuánto corresponde pagarle a cada uno.</p>
            {!porProveedor || porProveedor.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Sin ventas registradas este mes</CardContent></Card>
            ) : <div className="space-y-4">{porProveedor.map(prov => {
            const abierto = expandidoProv === prov.proveedorNombre;
            return (
              <Card key={prov.proveedorNombre} className="overflow-hidden">
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-base">{prov.proveedorNombre}</p>
                      <p className="text-xs text-muted-foreground">{prov.productos.length} productos vendidos</p>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {/* Lo que vendí de este proveedor */}
                    <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                      <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Vendí</p>
                        <p className="font-bold text-sm text-primary">{formatCurrency(prov.ingresos)}</p>
                      </div>
                    </div>
                    {/* A pagar al proveedor */}
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <ShoppingBag className="w-4 h-4 text-red-500 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">A pagarle</p>
                        <p className="font-bold text-sm text-red-700">{formatCurrency(prov.costoTotal)}</p>
                      </div>
                    </div>
                    {/* Lo que me queda */}
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <TrendingUp className="w-4 h-4 text-green-600 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Me queda</p>
                        <p className="font-bold text-sm text-green-700">{formatCurrency(prov.ganancia)}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto shrink-0"
                    onClick={() => setExpandidoProv(abierto ? null : prov.proveedorNombre)}
                  >
                    {abierto ? <><ChevronUp className="w-4 h-4" /> Ocultar</> : <><ChevronDown className="w-4 h-4" /> Ver detalle</>}
                  </button>
                </div>

                {abierto && (
                  <div className="border-t p-4">
                    <p className="font-semibold text-sm mb-3">Productos vendidos de {prov.proveedorNombre}</p>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-right">Cant.</TableHead>
                            <TableHead className="text-right">Costo total</TableHead>
                            <TableHead className="text-right">Vendido</TableHead>
                            <TableHead className="text-right">Me queda</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {prov.productos.map(p => (
                            <TableRow key={p.codigo}>
                              <TableCell className="font-medium">{p.nombre}</TableCell>
                              <TableCell className="text-right">{p.cantidad}</TableCell>
                              <TableCell className="text-right text-red-700">{formatCurrency(p.costoTotal)}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(p.ingresos)}</TableCell>
                              <TableCell className="text-right text-green-700 font-medium">{formatCurrency(p.ganancia)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/30 font-bold">
                            <TableCell>TOTAL</TableCell>
                            <TableCell />
                            <TableCell className="text-right text-red-700">{formatCurrency(prov.costoTotal)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(prov.ingresos)}</TableCell>
                            <TableCell className="text-right text-green-700">{formatCurrency(prov.ganancia)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}</div>}
          </div>
        </TabsContent>

        <TabsContent value="pordia" className="pt-6 space-y-4">
          <p className="text-sm text-muted-foreground">Desglose diario — ventas por proveedor y gastos del día descontados de tus ganancias.</p>
          {!porDia || porDia.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Sin ventas ni gastos registrados en los últimos 30 días</CardContent></Card>
          ) : porDia.map(dia => {
            const abierto = expandidoDia === dia.fecha;
            const tieneGastos = dia.totalGastos > 0;
            const fechaLabel = (() => {
              try { return format(parseISO(dia.fecha), "EEEE d 'de' MMMM", { locale: es }); } catch { return dia.fecha; }
            })();
            return (
              <Card key={dia.fecha} className="overflow-hidden">
                {/* Cabecera del día */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                  <button
                    className="flex items-center gap-3 flex-1 text-left"
                    onClick={() => { setExpandidoDia(abierto ? null : dia.fecha); setExpandidoDiaProv(null); }}
                  >
                    <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-base capitalize">{fechaLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {dia.proveedores.length} proveedor{dia.proveedores.length !== 1 ? "es" : ""}
                        {tieneGastos && <span className="text-orange-600 ml-2">· {dia.gastos.length} gasto{dia.gastos.length !== 1 ? "s" : ""}</span>}
                      </p>
                    </div>
                  </button>

                  <div className="flex flex-col gap-2 sm:items-end">
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                        <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Vendí</p>
                          <p className="font-bold text-sm text-primary">{formatCurrency(dia.totalVendido)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <ShoppingBag className="w-4 h-4 text-red-500 shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">A pagar prov.</p>
                          <p className="font-bold text-sm text-red-700">{formatCurrency(dia.totalCosto)}</p>
                        </div>
                      </div>
                      {tieneGastos && (
                        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                          <Receipt className="w-4 h-4 text-orange-500 shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gastos</p>
                            <p className="font-bold text-sm text-orange-700">{formatCurrency(dia.totalGastos)}</p>
                          </div>
                        </div>
                      )}
                      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${tieneGastos ? "bg-emerald-50 border-emerald-300" : "bg-green-50 border-green-200"}`}>
                        <TrendingUp className={`w-4 h-4 shrink-0 ${tieneGastos ? "text-emerald-600" : "text-green-600"}`} />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{tieneGastos ? "Me queda (real)" : "Me queda"}</p>
                          <p className={`font-bold text-sm ${tieneGastos ? "text-emerald-700" : "text-green-700"}`}>{formatCurrency(dia.gananciaReal)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm" variant="outline"
                        className="gap-1.5 text-xs h-7"
                        onClick={e => { e.stopPropagation(); const a = document.createElement("a"); a.href = `/api/reportes/proveedores-por-dia/${dia.fecha}/exportar`; a.download = ""; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}
                      >
                        <Download className="w-3 h-3" /> CSV
                      </Button>
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
                        onClick={() => { setExpandidoDia(abierto ? null : dia.fecha); setExpandidoDiaProv(null); }}
                      >
                        {abierto ? <><ChevronUp className="w-4 h-4" /> Ocultar</> : <><ChevronDown className="w-4 h-4" /> Ver detalle</>}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Detalle expandido */}
                {abierto && (
                  <div className="border-t divide-y">
                    {/* Gastos del día */}
                    {tieneGastos && (
                      <div className="p-4 bg-orange-50/50">
                        <p className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-1.5">
                          <Receipt className="w-4 h-4" /> Gastos del día
                        </p>
                        <div className="space-y-1">
                          {dia.gastos.map((g, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{g.descripcion}</span>
                              <span className="font-semibold text-orange-700">{formatCurrency(Number(g.monto))}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm border-t pt-1 mt-1 font-bold text-orange-800">
                            <span>Total gastos</span>
                            <span>{formatCurrency(dia.totalGastos)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Proveedores */}
                    {dia.proveedores.map(prov => {
                      const provKey = `${dia.fecha}-${prov.proveedorNombre}`;
                      const provAbierto = expandidoDiaProv === provKey;
                      return (
                        <div key={prov.proveedorNombre} className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-2 flex-1">
                              <Truck className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-medium text-sm">{prov.proveedorNombre}</span>
                              <span className="text-xs text-muted-foreground">({prov.productos.length} prod.)</span>
                            </div>
                            <div className="flex gap-2 flex-wrap text-xs">
                              <span className="bg-red-50 border border-red-200 text-red-700 font-semibold rounded px-2 py-1">
                                Pagar: {formatCurrency(prov.costoTotal)}
                              </span>
                              <span className="bg-green-50 border border-green-200 text-green-700 font-semibold rounded px-2 py-1">
                                Queda: {formatCurrency(prov.ganancia)}
                              </span>
                            </div>
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
                              onClick={() => setExpandidoDiaProv(provAbierto ? null : provKey)}
                            >
                              {provAbierto ? <><ChevronUp className="w-3.5 h-3.5" /> Ocultar</> : <><ChevronDown className="w-3.5 h-3.5" /> Ver productos</>}
                            </button>
                          </div>
                          {provAbierto && (
                            <div className="mt-3 overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-right">Cant.</TableHead>
                                    <TableHead className="text-right">Costo</TableHead>
                                    <TableHead className="text-right">Vendido</TableHead>
                                    <TableHead className="text-right">Me queda</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {prov.productos.map((p, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="font-medium">{p.nombre}</TableCell>
                                      <TableCell className="text-right">{p.cantidad}</TableCell>
                                      <TableCell className="text-right text-red-700">{formatCurrency(p.costoTotal)}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(p.ingresos)}</TableCell>
                                      <TableCell className="text-right text-green-700 font-medium">{formatCurrency(p.ganancia)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
