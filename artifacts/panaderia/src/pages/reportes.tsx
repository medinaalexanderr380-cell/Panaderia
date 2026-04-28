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
import { BarChart as BarChartIcon, TrendingUp, Users, PieChart } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Reportes() {
  const { data: ventasMes } = useObtenerVentasPorDia({ dias: 30 }, { query: { queryKey: getObtenerVentasPorDiaQueryKey({ dias: 30 }) } });
  const { data: topProductos } = useObtenerTopProductos();
  const { data: vendedores } = useObtenerReporteVendedores();
  const { data: resumen } = useObtenerResumen();

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

        <TabsContent value="equipo" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento del Equipo</CardTitle>
              <CardDescription>Ventas y ganancias generadas por vendedor</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-center">Operaciones</TableHead>
                    <TableHead className="text-right">Total Facturado</TableHead>
                    <TableHead className="text-right">Ganancia Generada</TableHead>
                    <TableHead className="text-right">Ticket Promedio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendedores?.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay datos de vendedores.</TableCell></TableRow>
                  ) : (
                    vendedores?.map((v, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {v.vendedor.substring(0, 2).toUpperCase()}
                          </div>
                          {v.vendedor}
                        </TableCell>
                        <TableCell className="text-center">{v.cantidadVentas}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(v.totalVentas)}</TableCell>
                        <TableCell className="text-right text-primary">{formatCurrency(v.gananciaGenerada)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(v.cantidadVentas > 0 ? v.totalVentas / v.cantidadVentas : 0)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}