import { useState, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListarProductos,
  useRegistrarVenta,
  useListarDiasConVentas,
  getListarDiasConVentasQueryKey,
  useEliminarVenta,
  useEliminarVentasDia,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ShoppingCart, User, Search, Trash2, Calendar, Receipt,
  ChevronDown, ChevronRight, Download, TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const fmt = (n: number) =>
  new Intl.NumberFormat("es", { style: "currency", currency: "MXN" }).format(n);

interface CartItem {
  productoCodigo: string;
  productoNombre: string;
  productoDescripcion: string;
  precioUnitario: number;
  cantidad: number;
  stockDisponible: number;
  subtotal: number;
}

/* ─── POS Section ──────────────────────────────────────────────────────────── */
function POS() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [vendedor, setVendedor] = useState("");
  const [codigoInput, setCodigoInput] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [previewProduct, setPreviewProduct] = useState<CartItem | null>(null);
  const codigoRef = useRef<HTMLInputElement>(null);

  const { data: productos } = useListarProductos();

  const registrarVenta = useRegistrarVenta({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarDiasConVentasQueryKey() });
        toast({ title: "Venta registrada exitosamente" });
        setCart([]);
        setPreviewProduct(null);
        setCodigoInput("");
        codigoRef.current?.focus();
      },
      onError: (err: any) => {
        toast({
          title: "Error al registrar venta",
          description: err?.response?.data?.error || "Verifica los datos",
          variant: "destructive",
        });
      },
    },
  });

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.subtotal, 0), [cart]);

  const handleAddProduct = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const codigo = codigoInput.trim();
    if (!codigo) return;

    const producto = productos?.find(
      (p) => p.codigo.toLowerCase() === codigo.toLowerCase()
    );

    if (!producto) {
      toast({ title: "Producto no encontrado", description: `Código: ${codigo}`, variant: "destructive" });
      return;
    }

    const preview: CartItem = {
      productoCodigo: producto.codigo,
      productoNombre: producto.nombre,
      productoDescripcion: producto.descripcion,
      precioUnitario: producto.precioVenta,
      cantidad: 1,
      stockDisponible: producto.stock,
      subtotal: producto.precioVenta,
    };
    setPreviewProduct(preview);

    if (producto.stock <= 0) {
      toast({ title: "Sin stock", description: `${producto.nombre} no tiene unidades disponibles.`, variant: "destructive" });
      setCodigoInput("");
      return;
    }

    const existing = cart.find((i) => i.productoCodigo === producto.codigo);
    if (existing) {
      if (existing.cantidad >= producto.stock) {
        toast({ title: "Stock insuficiente", description: `Solo hay ${producto.stock} disponibles.`, variant: "destructive" });
      } else {
        setCart(cart.map((i) =>
          i.productoCodigo === producto.codigo
            ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precioUnitario }
            : i
        ));
      }
    } else {
      setCart([...cart, preview]);
    }

    setCodigoInput("");
    codigoRef.current?.focus();
  };

  const updateQty = (codigo: string, delta: number) => {
    setCart(cart.map((i) => {
      if (i.productoCodigo !== codigo) return i;
      const qty = Math.max(1, Math.min(i.cantidad + delta, i.stockDisponible));
      return { ...i, cantidad: qty, subtotal: qty * i.precioUnitario };
    }));
  };

  const removeItem = (codigo: string) => {
    setCart(cart.filter((i) => i.productoCodigo !== codigo));
    if (previewProduct?.productoCodigo === codigo) setPreviewProduct(null);
  };

  const handleConfirm = () => {
    if (!vendedor.trim()) {
      toast({ title: "Falta el vendedor", variant: "destructive" });
      return;
    }
    if (cart.length === 0) {
      toast({ title: "Carrito vacío", variant: "destructive" });
      return;
    }
    registrarVenta.mutate({
      data: {
        vendedor,
        items: cart.map((i) => ({ productoCodigo: i.productoCodigo, cantidad: i.cantidad })),
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: form + cart */}
      <Card className="lg:col-span-2 shadow-md border-primary/20">
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="w-5 h-5 text-primary" />
            Nueva Venta
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {/* Vendor + code fields */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="sm:w-1/3">
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Vendedor</label>
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nombre..."
                  className="pl-8"
                  value={vendedor}
                  onChange={(e) => setVendedor(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                Código de producto
              </label>
              <form onSubmit={handleAddProduct} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={codigoRef}
                    placeholder="Escanea o escribe el código y presiona Enter..."
                    className="pl-8 font-mono"
                    value={codigoInput}
                    onChange={(e) => setCodigoInput(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="secondary">Agregar</Button>
              </form>
            </div>
          </div>

          {/* Product preview card */}
          {previewProduct && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground font-mono mb-0.5">{previewProduct.productoCodigo}</p>
              <p className="font-semibold text-foreground">{previewProduct.productoNombre}</p>
              <p className="text-sm text-muted-foreground mt-1">{previewProduct.productoDescripcion}</p>
              <div className="flex gap-6 mt-2 text-sm">
                <span>
                  Precio: <strong className="text-primary">{fmt(previewProduct.precioUnitario)}</strong>
                </span>
                <span>
                  Stock: <strong className={previewProduct.stockDisponible <= 5 ? "text-destructive" : "text-foreground"}>
                    {previewProduct.stockDisponible} {previewProduct.stockDisponible === 1 ? "unidad" : "unidades"}
                  </strong>
                </span>
              </div>
            </div>
          )}

          {/* Cart table */}
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-center w-36">Cantidad</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      El carrito está vacío. Escanea un código para comenzar.
                    </TableCell>
                  </TableRow>
                ) : (
                  cart.map((item) => (
                    <TableRow key={item.productoCodigo} className="group">
                      <TableCell className="font-mono text-xs">{item.productoCodigo}</TableCell>
                      <TableCell className="font-medium">{item.productoNombre}</TableCell>
                      <TableCell className="text-right">{fmt(item.precioUnitario)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.productoCodigo, -1)}>−</Button>
                          <span className="w-8 text-center font-bold">{item.cantidad}</span>
                          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.productoCodigo, 1)}>+</Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">{fmt(item.subtotal)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeItem(item.productoCodigo)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Right: summary */}
      <Card className="shadow-md flex flex-col">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="text-lg">Resumen</CardTitle>
        </CardHeader>
        <CardContent className="p-6 flex-1 flex flex-col justify-between">
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-muted-foreground text-sm">
              <span>Productos distintos</span>
              <span>{cart.length}</span>
            </div>
            <div className="flex justify-between text-muted-foreground text-sm">
              <span>Total unidades</span>
              <span>{cart.reduce((s, i) => s + i.cantidad, 0)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between text-2xl font-bold">
              <span>Total</span>
              <span className="text-primary">{fmt(cartTotal)}</span>
            </div>
          </div>
          <Button
            className="w-full h-14 text-lg font-semibold"
            onClick={handleConfirm}
            disabled={cart.length === 0 || registrarVenta.isPending}
          >
            {registrarVenta.isPending ? "Procesando..." : "Confirmar Venta"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Day group row ────────────────────────────────────────────────────────── */
function DiaGroup({ dia }: { dia: { fecha: string; totalVentas: number; totalGanancia: number; cantidadVentas: number; ventas: any[] } }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "venta" | "dia"; id?: number; label: string } | null>(null);

  const eliminarVenta = useEliminarVenta({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarDiasConVentasQueryKey() });
        toast({ title: "Venta eliminada" });
        setConfirmDelete(null);
      },
      onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
    },
  });

  const eliminarDia = useEliminarVentasDia({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarDiasConVentasQueryKey() });
        toast({ title: `Ventas del día ${dia.fecha} eliminadas` });
        setConfirmDelete(null);
      },
      onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
    },
  });

  const handleDownload = () => {
    const url = `/api/ventas/dia/${dia.fecha}/exportar`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas-${dia.fecha}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "Descarga iniciada", description: `ventas-${dia.fecha}.csv` });
  };

  const handleConfirmAction = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "venta" && confirmDelete.id != null) {
      eliminarVenta.mutate({ id: confirmDelete.id });
    } else if (confirmDelete.type === "dia") {
      eliminarDia.mutate({ fecha: dia.fecha });
    }
  };

  const fechaLabel = format(parseISO(dia.fecha + "T00:00:00"), "EEEE d 'de' MMMM yyyy", { locale: es });
  const margen = dia.totalVentas > 0 ? ((dia.totalGanancia / dia.totalVentas) * 100).toFixed(1) : "0.0";

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* Day header */}
        <div className="border rounded-xl overflow-hidden mb-3 shadow-sm">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-4 bg-card hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <Calendar className="w-4 h-4 text-primary" />
                <div>
                  <p className="font-semibold capitalize">{fechaLabel}</p>
                  <p className="text-xs text-muted-foreground">{dia.cantidadVentas} venta{dia.cantidadVentas !== 1 ? "s" : ""}</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">Total del día</p>
                  <p className="font-bold text-foreground">{fmt(dia.totalVentas)}</p>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-xs text-muted-foreground">Ganancia</p>
                  <p className="font-bold text-primary">{fmt(dia.totalGanancia)}</p>
                </div>
                <div className="text-right hidden lg:block">
                  <p className="text-xs text-muted-foreground">Margen</p>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    <p className="font-semibold text-primary">{margen}%</p>
                  </div>
                </div>

                {/* Action buttons — stop propagation so they don't toggle open */}
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDownload}>
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Descargar</span>
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                    onClick={() => setConfirmDelete({ type: "dia", label: `todas las ventas del ${dia.fecha}` })}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Borrar día</span>
                  </Button>
                </div>
              </div>
            </div>
          </CollapsibleTrigger>

          {/* Sales list */}
          <CollapsibleContent>
            <div className="border-t">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-20">#</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Productos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ganancia</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dia.ventas.map((venta: any) => (
                    <TableRow key={venta.id} className="group">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{String(venta.id).padStart(4, "0")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(parseISO(venta.fecha), "HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="font-medium">{venta.vendedor}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {venta.items?.map((item: any) => (
                            <Badge key={item.id} variant="secondary" className="text-xs font-normal">
                              {item.cantidad}× {item.productoNombre}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">{fmt(venta.total)}</TableCell>
                      <TableCell className="text-right font-medium text-primary">{fmt(venta.ganancia)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setConfirmDelete({ type: "venta", id: venta.id, label: `venta #${String(venta.id).padStart(4, "0")}` })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Day footer summary */}
              <div className="flex justify-end gap-8 px-6 py-3 bg-muted/20 border-t text-sm">
                <span className="text-muted-foreground">Total del día: <strong className="text-foreground">{fmt(dia.totalVentas)}</strong></span>
                <span className="text-muted-foreground">Ganancia: <strong className="text-primary">{fmt(dia.totalGanancia)}</strong></span>
                <span className="text-muted-foreground">Margen: <strong className="text-primary">{margen}%</strong></span>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Confirm dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar {confirmDelete?.label}? Esta acción restaurará el stock de los productos
              y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmAction}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────────────── */
export default function Ventas() {
  const { data: dias, isLoading } = useListarDiasConVentas({
    query: { queryKey: getListarDiasConVentasQueryKey() },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
        <ShoppingCart className="w-8 h-8 text-primary" />
        Punto de Venta
      </h1>

      <POS />

      {/* History by day */}
      <section>
        <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Historial por Día
        </h2>

        {isLoading ? (
          <div className="text-muted-foreground py-8 text-center">Cargando historial...</div>
        ) : !dias || dias.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center border rounded-xl">
            No hay ventas registradas aún.
          </div>
        ) : (
          <div>
            {dias.map((dia) => (
              <DiaGroup key={dia.fecha} dia={dia} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
