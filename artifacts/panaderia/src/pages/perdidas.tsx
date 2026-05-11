import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, PackageX } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

interface Perdida {
  id: number;
  productoCodigo: string;
  productoNombre: string;
  cantidad: number;
  costoTotal: number;
  motivo: string;
  origen: string;
  registradoPor: string;
  fecha: string;
}

function usePerdidas() {
  return useQuery<Perdida[]>({
    queryKey: ["perdidas"],
    queryFn: () =>
      fetch("/api/perdidas", { credentials: "include" }).then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
  });
}

export default function Perdidas() {
  const { data: perdidas = [], isLoading } = usePerdidas();

  const totalCosto = perdidas.reduce((acc, p) => acc + Number(p.costoTotal), 0);
  const totalUnidades = perdidas.reduce((acc, p) => acc + p.cantidad, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        Pérdidas
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Total pérdidas</p>
            <p className="text-2xl font-bold text-destructive">{fmt(totalCosto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Unidades perdidas</p>
            <p className="text-2xl font-bold">{totalUnidades}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Registros</p>
            <p className="text-2xl font-bold">{perdidas.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de pérdidas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-center">Cant.</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Registrado por</TableHead>
                <TableHead className="text-right">Costo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : perdidas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <PackageX className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    Sin pérdidas registradas
                  </TableCell>
                </TableRow>
              ) : (
                perdidas.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(parseISO(p.fecha), "dd MMM yyyy HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{p.productoNombre}</TableCell>
                    <TableCell className="text-center font-bold">{p.cantidad}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-amber-700 border-amber-300 bg-amber-50">
                        {p.motivo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {p.origen === "camioneta" ? "🚚 Camioneta" : "🏪 Panadería"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{p.registradoPor}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">
                      {fmt(Number(p.costoTotal))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
