import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListarProductos } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Truck, Plus, Trash2, ShoppingCart, Package, AlertTriangle, User, Search, ArrowDownToLine } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth";

const fmt = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

interface StockItem { codigo: string; nombre: string; stockCamioneta: number; precioVenta: number; precioCosto: number; unidad: string; descripcion: string }
interface CartItem { productoCodigo: string; productoNombre: string; cantidad: number; precioUnitario: number; }
interface CargaItem { productoCodigo: string; productoNombre: string; cantidad: number; stockDisponible: number; }

function useCamionetaStock() {
  return useQuery<StockItem[]>({
    queryKey: ["camioneta", "stock"],
    queryFn: () => fetch("/api/camioneta/stock", { credentials: "include" }).then(r => r.json()),
  });
}

function useCargaMutation(onSuccess: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { productoCodigo: string; cantidad: number }[]) =>
      fetch("/api/camioneta/cargar", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) })
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["camioneta", "stock"] }); queryClient.invalidateQueries({ queryKey: ["listarProductos"] }); onSuccess(); },
  });
}

function useVentaRutaMutation(onSuccess: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { vendedor: string; items: { productoCodigo: string; cantidad: number }[] }) =>
      fetch("/api/camioneta/ventas", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["camioneta", "stock"] }); onSuccess(); },
  });
}

function useCaducadoMutation(onSuccess: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { productoCodigo: string; cantidad: number; origen: string }) =>
      fetch("/api/camioneta/caducado", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["camioneta", "stock"] }); queryClient.invalidateQueries({ queryKey: ["listarProductos"] }); onSuccess(); },
  });
}

// ─── Pestaña: Stock en Camioneta ────────────────────────────────────────────
function TabStock({ stock, isLoading, onCaducado }: { stock: StockItem[] | undefined; isLoading: boolean; onCaducado: (item: StockItem) => void }) {
  return (
    <Card>
      <CardHeader className="bg-muted/30 border-b pb-4">
        <CardTitle className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" /> Inventario en Camioneta
        </CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-center">Stock a bordo</TableHead>
              <TableHead className="text-right">Precio Venta</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell></TableRow>
            ) : !stock?.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Truck className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-muted-foreground">La camioneta está vacía. Cargá productos desde la pestaña "Cargar".</p>
                </TableCell>
              </TableRow>
            ) : stock.map(item => (
              <TableRow key={item.codigo}>
                <TableCell>
                  <p className="font-medium">{item.nombre}</p>
                  <p className="text-xs text-muted-foreground font-mono">{item.codigo}</p>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={item.stockCamioneta <= 5 ? "destructive" : "secondary"}>
                    {item.stockCamioneta} {item.unidad}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{fmt(item.precioVenta)}</TableCell>
                <TableCell className="text-right font-medium">{fmt(item.precioVenta * item.stockCamioneta)}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50 text-xs" onClick={() => onCaducado(item)}>
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Caducado
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {stock && stock.length > 0 && (
        <div className="px-6 py-3 bg-muted/20 border-t flex justify-end gap-6 text-sm">
          <span className="text-muted-foreground">Total unidades: <strong>{stock.reduce((s, i) => s + i.stockCamioneta, 0)}</strong></span>
          <span className="text-muted-foreground">Valor total: <strong className="text-primary">{fmt(stock.reduce((s, i) => s + i.precioVenta * i.stockCamioneta, 0))}</strong></span>
        </div>
      )}
    </Card>
  );
}

// ─── Pestaña: Cargar Camioneta ───────────────────────────────────────────────
function TabCargar() {
  const { toast } = useToast();
  const { data: productos } = useListarProductos();
  const [search, setSearch] = useState("");
  const [cargaItems, setCargaItems] = useState<CargaItem[]>([]);

  const cargaMutation = useCargaMutation(() => {
    toast({ title: "¡Camioneta cargada exitosamente!" });
    setCargaItems([]);
  });

  const productosFiltrados = (productos ?? []).filter(p =>
    p.stock > 0 && (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCarga = (p: any) => {
    setCargaItems(prev => {
      const ex = prev.find(i => i.productoCodigo === p.codigo);
      if (ex) return prev.map(i => i.productoCodigo === p.codigo ? { ...i, cantidad: Math.min(i.cantidad + 1, i.stockDisponible) } : i);
      return [...prev, { productoCodigo: p.codigo, productoNombre: p.nombre, cantidad: 1, stockDisponible: p.stock }];
    });
  };

  const updateCantidad = (codigo: string, val: number) => {
    setCargaItems(prev => prev.map(i => i.productoCodigo === codigo ? { ...i, cantidad: Math.max(1, Math.min(val, i.stockDisponible)) } : i));
  };

  const handleCargar = () => {
    if (cargaItems.length === 0) { toast({ title: "Agregá productos primero", variant: "destructive" }); return; }
    cargaMutation.mutate(cargaItems.map(i => ({ productoCodigo: i.productoCodigo, cantidad: i.cantidad })));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="text-base">Seleccionar Productos del Stock General</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar producto..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {productosFiltrados.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No hay productos con stock disponible</p>
            ) : productosFiltrados.map(p => (
              <div key={p.codigo} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 cursor-pointer" onClick={() => addToCarga(p)}>
                <div>
                  <p className="font-medium text-sm">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground">{p.codigo} · Stock: {p.stock} {p.unidad}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-primary">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" /> A Cargar
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {cargaItems.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">Seleccioná productos de la lista</p>
          ) : cargaItems.map(item => (
            <div key={item.productoCodigo} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.productoNombre}</p>
                <p className="text-xs text-muted-foreground">Máx: {item.stockDisponible}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCantidad(item.productoCodigo, item.cantidad - 1)}>−</Button>
                <span className="w-8 text-center font-bold text-sm">{item.cantidad}</span>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCantidad(item.productoCodigo, item.cantidad + 1)}>+</Button>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setCargaItems(prev => prev.filter(i => i.productoCodigo !== item.productoCodigo))}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Button className="w-full mt-4" onClick={handleCargar} disabled={cargaItems.length === 0 || cargaMutation.isPending}>
            <Truck className="w-4 h-4 mr-2" />
            {cargaMutation.isPending ? "Cargando..." : "Confirmar Carga"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Pestaña: Venta en Ruta ─────────────────────────────────────────────────
function TabVentaRuta({ stock }: { stock: StockItem[] | undefined }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [vendedor, setVendedor] = useState(user?.nombre || "");
  const [cart, setCart] = useState<CartItem[]>([]);

  const ventaMutation = useVentaRutaMutation(() => {
    toast({ title: "Venta en ruta registrada" });
    setCart([]);
  });

  const addToCart = (item: StockItem) => {
    setCart(prev => {
      const ex = prev.find(i => i.productoCodigo === item.codigo);
      const maxQty = item.stockCamioneta;
      if (ex) {
        if (ex.cantidad >= maxQty) { toast({ title: "Sin stock en camioneta", variant: "destructive" }); return prev; }
        return prev.map(i => i.productoCodigo === item.codigo ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...prev, { productoCodigo: item.codigo, productoNombre: item.nombre, cantidad: 1, precioUnitario: item.precioVenta }];
    });
  };

  const total = cart.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader className="bg-primary/5 border-b pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" /> Productos en Camioneta
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {!stock?.length ? (
            <p className="text-center py-8 text-muted-foreground">La camioneta está vacía. Cargá productos primero.</p>
          ) : (
            <div className="space-y-2">
              {stock.map(item => (
                <div key={item.codigo} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 cursor-pointer" onClick={() => addToCart(item)}>
                  <div>
                    <p className="font-medium text-sm">{item.nombre}</p>
                    <p className="text-xs text-muted-foreground">Stock bordo: {item.stockCamioneta} · {fmt(item.precioVenta)}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-primary"><Plus className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="text-base">Resumen de Venta</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Vendedor</label>
            <div className="relative">
              <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Nombre del vendedor" className="pl-8 text-sm" value={vendedor} onChange={e => setVendedor(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            {cart.map(item => (
              <div key={item.productoCodigo} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.productoNombre}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setCart(c => c.map(i => i.productoCodigo === item.productoCodigo ? { ...i, cantidad: Math.max(0, i.cantidad - 1) } : i).filter(i => i.cantidad > 0))}>−</Button>
                  <span className="w-6 text-center text-sm font-bold">{item.cantidad}</span>
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setCart(c => c.map(i => i.productoCodigo === item.productoCodigo ? { ...i, cantidad: i.cantidad + 1 } : i))}>+</Button>
                </div>
                <span className="text-xs font-medium w-20 text-right">{fmt(item.cantidad * item.precioUnitario)}</span>
              </div>
            ))}
          </div>
          {cart.length > 0 && (
            <div className="border-t pt-3 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary">{fmt(total)}</span>
            </div>
          )}
          <Button className="w-full" onClick={() => ventaMutation.mutate({ vendedor, items: cart.map(i => ({ productoCodigo: i.productoCodigo, cantidad: i.cantidad })) })}
            disabled={cart.length === 0 || !vendedor.trim() || ventaMutation.isPending}>
            {ventaMutation.isPending ? "Registrando..." : "Confirmar Venta en Ruta"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Página Principal ────────────────────────────────────────────────────────
type Tab = "stock" | "cargar" | "venta";

export default function Camioneta() {
  const [tab, setTab] = useState<Tab>("stock");
  const { data: stock, isLoading } = useCamionetaStock();
  const { toast } = useToast();
  const [caducadoDialog, setCaducadoDialog] = useState<StockItem | null>(null);
  const [caducadoCantidad, setCaducadoCantidad] = useState(1);

  const caducadoMutation = useCaducadoMutation(() => {
    toast({ title: "Pérdida registrada correctamente" });
    setCaducadoDialog(null);
  });

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "stock", label: "Mi Camioneta", icon: Truck },
    { id: "cargar", label: "Cargar", icon: ArrowDownToLine },
    { id: "venta", label: "Venta en Ruta", icon: ShoppingCart },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
        <Truck className="w-8 h-8 text-primary" /> Mi Camioneta
      </h1>

      <div className="flex gap-2 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stock" && <TabStock stock={stock} isLoading={isLoading} onCaducado={item => { setCaducadoDialog(item); setCaducadoCantidad(1); }} />}
      {tab === "cargar" && <TabCargar />}
      {tab === "venta" && <TabVentaRuta stock={stock} />}

      <AlertDialog open={!!caducadoDialog} onOpenChange={o => !o && setCaducadoDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" /> Registrar Producto Caducado
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>Producto: <strong>{caducadoDialog?.nombre}</strong></p>
              <p>Stock en camioneta: <strong>{caducadoDialog?.stockCamioneta}</strong></p>
              <div>
                <label className="text-sm font-medium mb-1 block">Cantidad a dar de baja:</label>
                <Input
                  type="number"
                  min={1}
                  max={caducadoDialog?.stockCamioneta}
                  value={caducadoCantidad}
                  onChange={e => setCaducadoCantidad(Number(e.target.value))}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Pérdida estimada: <strong className="text-destructive">{caducadoDialog ? fmt(caducadoDialog.precioCosto * caducadoCantidad) : ""}</strong>
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => caducadoDialog && caducadoMutation.mutate({ productoCodigo: caducadoDialog.codigo, cantidad: caducadoCantidad, origen: "camioneta" })}
            >
              Registrar como Caducado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
