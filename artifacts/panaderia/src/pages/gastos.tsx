import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Receipt, Plus, Trash2, TrendingDown, CalendarDays } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Gasto {
  id: number;
  descripcion: string;
  monto: string;
  fecha: string;
}

export default function Gastos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState<number | "">("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: gastos, isLoading } = useQuery<Gasto[]>({
    queryKey: ["gastos"],
    queryFn: () => fetch("/api/gastos", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const agregarMutation = useMutation({
    mutationFn: (data: { descripcion: string; monto: number }) =>
      fetch("/api/gastos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => {
      toast({ title: "Gasto registrado" });
      setDescripcion("");
      setMonto("");
      queryClient.invalidateQueries({ queryKey: ["gastos"] });
      queryClient.invalidateQueries({ queryKey: ["reportes", "proveedores-por-dia"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/gastos/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Gasto eliminado" });
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["gastos"] });
      queryClient.invalidateQueries({ queryKey: ["reportes", "proveedores-por-dia"] });
    },
  });

  // Agrupar por día
  const porDia = (gastos ?? []).reduce<Record<string, Gasto[]>>((acc, g) => {
    const d = g.fecha.slice(0, 10);
    if (!acc[d]) acc[d] = [];
    acc[d].push(g);
    return acc;
  }, {});
  const dias = Object.keys(porDia).sort((a, b) => b.localeCompare(a));

  const totalMes = (gastos ?? []).reduce((s, g) => s + Number(g.monto), 0);

  const handleAgregar = () => {
    if (!descripcion.trim()) return toast({ title: "Ingresá una descripción", variant: "destructive" });
    if (!monto || Number(monto) <= 0) return toast({ title: "Ingresá un monto válido", variant: "destructive" });
    agregarMutation.mutate({ descripcion: descripcion.trim(), monto: Number(monto) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="w-8 h-8 text-primary" /> Gastos
        </h1>
        <p className="text-muted-foreground mt-1">Registrá gastos del día para descontarlos de tus ganancias</p>
      </div>

      {/* Resumen del mes */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total este mes</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalMes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Gastos registrados</p>
            <p className="text-2xl font-bold">{(gastos ?? []).length}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Días con gastos</p>
            <p className="text-2xl font-bold">{dias.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Formulario de carga */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" /> Agregar gasto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Ej: Harina extra, combustible, bolsas..."
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              className="flex-1"
              onKeyDown={e => e.key === "Enter" && handleAgregar()}
            />
            <Input
              type="number"
              placeholder="Monto $"
              min="0.01"
              step="0.01"
              value={monto}
              onChange={e => setMonto(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full sm:w-40"
              onKeyDown={e => e.key === "Enter" && handleAgregar()}
            />
            <Button onClick={handleAgregar} disabled={agregarMutation.isPending} className="shrink-0">
              <Plus className="w-4 h-4 mr-1" />
              {agregarMutation.isPending ? "Guardando..." : "Agregar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista agrupada por día */}
      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Cargando...</CardContent></Card>
      ) : dias.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <TrendingDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No hay gastos registrados</p>
          <p className="text-xs mt-1">Usá el formulario de arriba para agregar el primer gasto</p>
        </CardContent></Card>
      ) : dias.map(dia => {
        const items = porDia[dia];
        const totalDia = items.reduce((s, g) => s + Number(g.monto), 0);
        const fechaLabel = (() => {
          try { return format(parseISO(dia), "EEEE d 'de' MMMM", { locale: es }); } catch { return dia; }
        })();

        return (
          <Card key={dia} className="overflow-hidden">
            <div className="p-4 flex items-center justify-between bg-muted/30 border-b">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold capitalize">{fechaLabel}</span>
                <Badge variant="secondary">{items.length} gasto{items.length !== 1 ? "s" : ""}</Badge>
              </div>
              <span className="font-bold text-red-600">{formatCurrency(totalDia)}</span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(g => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.descripcion}</TableCell>
                      <TableCell className="text-right text-red-700 font-semibold">{formatCurrency(Number(g.monto))}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost" size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                          onClick={() => setDeleteId(g.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        );
      })}

      {/* Confirmación de borrado */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. El gasto se borrará del registro.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId !== null && eliminarMutation.mutate(deleteId)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
