import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListarProveedores,
  useListarCompras, getListarComprasQueryKey,
  useRegistrarCompra,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Truck, Plus, Trash2, Calendar, ChevronDown, ChevronRight, Package, Banknote, ShoppingBag, Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface CompraItem {
  productoCodigo: string;
  productoNombre: string;
  cantidad: number;
  precioCosto: number;
  subtotal: number;
}

interface DiaCompras {
  fecha: string;
  compras: Array<{
    id: number;
    proveedor: string;
    totalInvertido: number;
    items: Array<{ productoCodigo: string; productoNombre: string; cantidad: number; precioCosto: number; subtotal: number }>;
  }>;
  totalDia: number;
}

export default function Compras() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [proveedorInput, setProveedorInput] = useState("");
  const [items, setItems] = useState<CompraItem[]>([]);
  const [codigoInput, setCodigoInput] = useState("");
  const [nombreInput, setNombreInput] = useState("");
  const [cantidadInput, setCantidadInput] = useState(1);
  const [costoInput, setCostoInput] = useState(0);
  const [expandedDias, setExpandedDias] = useState<Set<string>>(new Set());
  const [expandedCompras, setExpandedCompras] = useState<Set<number>>(new Set());
  const [filtroProveedor, setFiltroProveedor] = useState("");

  const { data: proveedores } = useListarProveedores();
  const { data: compras, isLoading: isLoadingCompras } = useListarCompras({}, {
    query: { queryKey: getListarComprasQueryKey({}) }
  });

  const registrarCompra = useRegistrarCompra({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarComprasQueryKey({}) });
        toast({ title: "Compra registrada exitosamente" });
        setItems([]);
        setProveedorInput("");
      },
      onError: (err: any) => {
        toast({ title: "Error al registrar compra", description: err?.response?.data?.error || "Verifica los datos", variant: "destructive" });
      }
    }
  });

  const totalCompra = items.reduce((sum, i) => sum + i.subtotal, 0);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoInput.trim() || !nombreInput.trim() || cantidadInput <= 0 || costoInput < 0) {
      toast({ title: "Datos inválidos", description: "Completa todos los campos correctamente.", variant: "destructive" });
      return;
    }
    setItems([...items, {
      productoCodigo: codigoInput.trim().toUpperCase(),
      productoNombre: nombreInput.trim(),
      cantidad: cantidadInput,
      precioCosto: costoInput,
      subtotal: cantidadInput * costoInput
    }]);
    setCodigoInput("");
    setNombreInput("");
    setCantidadInput(1);
    setCostoInput(0);
  };

  const handleConfirmarCompra = () => {
    if (!proveedorInput.trim()) {
      toast({ title: "Falta proveedor", description: "Ingresa el nombre del proveedor.", variant: "destructive" });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Sin productos", description: "Agrega al menos un producto.", variant: "destructive" });
      return;
    }
    registrarCompra.mutate({
      data: {
        proveedor: proveedorInput.trim(),
        items: items.map(i => ({
          productoCodigo: i.productoCodigo,
          cantidad: i.cantidad,
          precioCosto: i.precioCosto
        }))
      }
    });
  };

  // Group compras by date, sorted most recent first
  const comprasFiltradas = (compras ?? []).filter(c =>
    filtroProveedor === "" || c.proveedor.toLowerCase().includes(filtroProveedor.toLowerCase())
  );

  const diasMap = new Map<string, DiaCompras>();
  for (const compra of comprasFiltradas) {
    const fecha = compra.fecha.split("T")[0];
    if (!diasMap.has(fecha)) {
      diasMap.set(fecha, { fecha, compras: [], totalDia: 0 });
    }
    const dia = diasMap.get(fecha)!;
    dia.compras.push(compra as any);
    dia.totalDia += compra.totalInvertido;
  }
  const dias: DiaCompras[] = Array.from(diasMap.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));

  const toggleDia = (fecha: string) => {
    setExpandedDias(prev => {
      const next = new Set(prev);
      next.has(fecha) ? next.delete(fecha) : next.add(fecha);
      return next;
    });
  };

  const toggleCompra = (id: number) => {
    setExpandedCompras(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Summary stats
  const totalInvertido = (compras ?? []).reduce((s, c) => s + c.totalInvertido, 0);
  const proveedoresUnicos = new Set((compras ?? []).map(c => c.proveedor)).size;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
        <Truck className="w-8 h-8 text-primary" />
        Inversiones / Compras
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Banknote className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Invertido</p>
              <p className="text-xl font-bold">{formatCurrency(totalInvertido)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-full">
              <ShoppingBag className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Compras Realizadas</p>
              <p className="text-xl font-bold">{compras?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Proveedores Distintos</p>
              <p className="text-xl font-bold">{proveedoresUnicos}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New purchase form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border shadow-md">
          <CardHeader className="bg-muted/30 pb-4 border-b border-border">
            <CardTitle className="text-lg">Nueva Compra</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div>
              <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Proveedor</label>
              <Input
                placeholder="Nombre del proveedor..."
                value={proveedorInput}
                onChange={e => setProveedorInput(e.target.value)}
                list="proveedores-list"
              />
              <datalist id="proveedores-list">
                {proveedores?.map(p => <option key={p.id} value={p.nombre} />)}
              </datalist>
            </div>

            <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-sm">Agregar Producto</h3>
              <form onSubmit={handleAddItem} className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[110px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Código</label>
                  <Input value={codigoInput} onChange={e => setCodigoInput(e.target.value)} placeholder="PAN001" required />
                </div>
                <div className="flex-[2] min-w-[140px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Nombre del producto</label>
                  <Input value={nombreInput} onChange={e => setNombreInput(e.target.value)} placeholder="Pan de sal..." required />
                </div>
                <div className="w-28">
                  <label className="text-xs text-muted-foreground mb-1 block">Costo unitario $</label>
                  <Input type="number" step="0.01" min="0" value={costoInput} onChange={e => setCostoInput(Number(e.target.value))} required />
                </div>
                <div className="w-20">
                  <label className="text-xs text-muted-foreground mb-1 block">Cantidad</label>
                  <Input type="number" min="1" value={cantidadInput} onChange={e => setCantidadInput(Number(e.target.value))} required />
                </div>
                <Button type="submit" variant="secondary" className="shrink-0 gap-1">
                  <Plus className="w-4 h-4" /> Agregar
                </Button>
              </form>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Costo Unit.</TableHead>
                  <TableHead className="text-center">Cant.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Sin productos agregados
                    </TableCell>
                  </TableRow>
                ) : items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">{item.productoCodigo}</TableCell>
                    <TableCell>{item.productoNombre}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.precioCosto)}</TableCell>
                    <TableCell className="text-center">{item.cantidad}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.subtotal)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-md border-border h-fit">
          <CardHeader className="bg-muted/30 pb-4 border-b border-border">
            <CardTitle className="text-lg">Resumen de Compra</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Proveedor:</span>
                <span className="font-medium text-foreground text-right max-w-[150px] truncate">{proveedorInput || "—"}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Productos distintos:</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Unidades totales:</span>
                <span>{items.reduce((s, i) => s + i.cantidad, 0)}</span>
              </div>
              <div className="pt-4 border-t border-border flex justify-between text-2xl font-bold">
                <span>Total:</span>
                <span className="text-primary">{formatCurrency(totalCompra)}</span>
              </div>
            </div>
            <Button
              className="w-full h-12"
              onClick={handleConfirmarCompra}
              disabled={items.length === 0 || !proveedorInput.trim() || registrarCompra.isPending}
            >
              {registrarCompra.isPending ? "Registrando..." : "Confirmar Compra"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* History grouped by date */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Historial de Inversiones</h2>
          <div className="flex items-center gap-2 max-w-xs w-full">
            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Filtrar por proveedor..."
              value={filtroProveedor}
              onChange={e => setFiltroProveedor(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        {isLoadingCompras ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Cargando historial...</CardContent></Card>
        ) : dias.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-muted-foreground">No hay compras registradas.</p>
            </CardContent>
          </Card>
        ) : dias.map(dia => {
          const isExpanded = expandedDias.has(dia.fecha);
          const fechaLabel = format(parseISO(dia.fecha), "EEEE dd 'de' MMMM yyyy", { locale: es });
          const fechaCapitalizada = fechaLabel.charAt(0).toUpperCase() + fechaLabel.slice(1);

          return (
            <Card key={dia.fecha} className="overflow-hidden border-border shadow-sm">
              {/* Day header */}
              <button
                className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                onClick={() => toggleDia(dia.fecha)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <Calendar className="w-4 h-4 text-primary" />
                  <div>
                    <span className="font-semibold text-foreground">{fechaCapitalizada}</span>
                    <div className="flex items-center gap-3 mt-0.5">
                      <Badge variant="secondary" className="text-xs font-normal">
                        {dia.compras.length} {dia.compras.length === 1 ? "compra" : "compras"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {[...new Set(dia.compras.map(c => c.proveedor))].join(", ")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-xs text-muted-foreground">Total del día</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(dia.totalDia)}</p>
                </div>
              </button>

              {/* Day purchases */}
              {isExpanded && (
                <div className="border-t border-border divide-y divide-border">
                  {dia.compras.map(compra => {
                    const isCompraExpanded = expandedCompras.has(compra.id);
                    return (
                      <div key={compra.id} className="bg-muted/10">
                        {/* Purchase row */}
                        <button
                          className="w-full text-left px-8 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
                          onClick={() => toggleCompra(compra.id)}
                        >
                          <div className="flex items-center gap-3">
                            {isCompraExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                            <Building2 className="w-4 h-4 text-amber-600" />
                            <div>
                              <span className="font-medium text-sm">{compra.proveedor}</span>
                              <p className="text-xs text-muted-foreground">
                                #{compra.id.toString().padStart(4, "0")} · {compra.items?.length || 0} {(compra.items?.length || 0) === 1 ? "producto" : "productos"}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold shrink-0 ml-4">{formatCurrency(compra.totalInvertido)}</span>
                        </button>

                        {/* Purchase items */}
                        {isCompraExpanded && compra.items && compra.items.length > 0 && (
                          <div className="px-8 pb-4">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="py-2 text-xs">Código</TableHead>
                                  <TableHead className="py-2 text-xs">Producto</TableHead>
                                  <TableHead className="py-2 text-xs text-right">Costo Unit.</TableHead>
                                  <TableHead className="py-2 text-xs text-center">Cant.</TableHead>
                                  <TableHead className="py-2 text-xs text-right">Subtotal</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {compra.items.map((item: any, idx: number) => (
                                  <TableRow key={idx} className="hover:bg-transparent">
                                    <TableCell className="py-2 font-mono text-xs text-muted-foreground">{item.productoCodigo}</TableCell>
                                    <TableCell className="py-2 text-sm">{item.productoNombre}</TableCell>
                                    <TableCell className="py-2 text-sm text-right">{formatCurrency(item.precioCosto)}</TableCell>
                                    <TableCell className="py-2 text-sm text-center">{item.cantidad}</TableCell>
                                    <TableCell className="py-2 text-sm text-right font-medium">{formatCurrency(item.subtotal)}</TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="hover:bg-transparent border-t border-border">
                                  <TableCell colSpan={4} className="py-2 text-right text-sm font-semibold text-muted-foreground">Total compra:</TableCell>
                                  <TableCell className="py-2 text-right font-bold text-primary">{formatCurrency(compra.totalInvertido)}</TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        {isCompraExpanded && (!compra.items || compra.items.length === 0) && (
                          <p className="px-8 pb-4 text-xs text-muted-foreground">Sin detalle de productos disponible.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
