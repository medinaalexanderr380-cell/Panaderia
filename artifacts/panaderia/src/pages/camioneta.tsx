import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Truck, Plus, Trash2, ShoppingCart, AlertTriangle, ArrowDownToLine, Lock, CheckCircle, Undo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const fmt = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

type Vendedor = "michel" | "david";

interface StockItem { codigo: string; nombre: string; stockCamioneta: number; precioVenta: number; precioCosto: number; unidad: string; descripcion: string }
interface CartItem { productoCodigo: string; productoNombre: string; cantidad: number; precioUnitario: number }
interface CargaItem { productoCodigo: string; productoNombre: string; cantidad: number; proveedor: string }

const VENDEDORES: { username: Vendedor; nombre: string }[] = [
  { username: "michel", nombre: "Michel" },
  { username: "david", nombre: "David" },
];

const DEV_PASSWORD = "04052005";

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useCamionetaStock(vendedor: Vendedor) {
  return useQuery<StockItem[]>({
    queryKey: ["camioneta", "stock", vendedor],
    queryFn: () => fetch(`/api/camioneta/stock?vendedor=${vendedor}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!vendedor,
  });
}

function useCargaMutation(vendedor: Vendedor, onSuccess: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: CargaItem[]) =>
      fetch("/api/camioneta/cargar", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendedor, items }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["camioneta", "stock", vendedor] });
      onSuccess();
    },
  });
}

function useVentaRutaMutation(vendedor: Vendedor, onSuccess: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { productoCodigo: string; cantidad: number }[]) =>
      fetch("/api/camioneta/ventas", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendedor, items }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["camioneta", "stock", vendedor] });
      onSuccess();
    },
  });
}

function useCaducadoMutation(vendedor: Vendedor, onSuccess: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { productoCodigo: string; cantidad: number }) =>
      fetch("/api/camioneta/caducado", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, origen: "camioneta", vendedor }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["camioneta", "stock", vendedor] });
      onSuccess();
    },
  });
}

// ─── Diálogo de verificación ──────────────────────────────────────────────────
interface CredDialogProps {
  open: boolean;
  vendedor: Vendedor;
  onOpenChange: (v: boolean) => void;
  onConfirm: (password: string) => void;
  isPending: boolean;
  error?: string;
  titulo?: string;
  descripcion?: string;
}

function CredDialog({ open, vendedor, onOpenChange, onConfirm, isPending, error, titulo, descripcion }: CredDialogProps) {
  const [password, setPassword] = useState("");
  const nombre = VENDEDORES.find(v => v.username === vendedor)?.nombre ?? vendedor;

  const handleClose = (v: boolean) => {
    if (!v) setPassword("");
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" /> {titulo || "Identificación"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            {descripcion ?? <>Confirmar identidad de <strong>{nombre}</strong></>}
          </p>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 text-xl tracking-widest"
              type="password"
              inputMode="numeric"
              placeholder="••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && password && onConfirm(password)}
              autoFocus
            />
          </div>
          {error && <p className="text-destructive text-sm bg-destructive/10 p-2 rounded">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={() => onConfirm(password)} disabled={isPending || !password}>
            {isPending ? "Verificando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function verificarCredenciales(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("/api/auth/verify", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const d = await r.json();
    if (!r.ok) return { ok: false, error: d.error || "Contraseña incorrecta" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Error de conexión" };
  }
}

// ─── Pestaña: Stock ───────────────────────────────────────────────────────────
function TabStock({ vendedor, stock, isLoading, onCaducado }: { vendedor: Vendedor; stock: StockItem[] | undefined; isLoading: boolean; onCaducado: (item: StockItem) => void }) {
  const nombre = VENDEDORES.find(v => v.username === vendedor)?.nombre;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [devolverItem, setDevolverItem] = useState<StockItem | null>(null);
  const [devolverCantidad, setDevolverCantidad] = useState<number | "">(1);
  const [credOpen, setCredOpen] = useState(false);
  const [credError, setCredError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const devolverMutation = useMutation({
    mutationFn: (items: { productoCodigo: string; cantidad: number }[]) =>
      fetch("/api/camioneta/devolver", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendedor, items }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["camioneta", "stock", vendedor] });
      toast({ title: "Productos devueltos al depósito" });
      setDevolverItem(null);
      setDevolverCantidad(1);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const handleDevolverClick = (item: StockItem) => {
    setDevolverItem(item);
    setDevolverCantidad(item.stockCamioneta);
    setCredError("");
  };

  const handleCredConfirm = async (password: string) => {
    if (!devolverItem || !devolverCantidad || Number(devolverCantidad) <= 0) return;
    setVerifying(true);
    setCredError("");
    const result = await verificarCredenciales(vendedor, password);
    setVerifying(false);
    if (!result.ok) { setCredError(result.error!); return; }
    setCredOpen(false);
    devolverMutation.mutate([{ productoCodigo: devolverItem.codigo, cantidad: Number(devolverCantidad) }]);
  };

  return (
    <>
      <Card>
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" /> Inventario de {nombre}
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
                    <p className="text-muted-foreground">La camioneta de {nombre} está vacía. Cargá productos desde "Cargar".</p>
                  </TableCell>
                </TableRow>
              ) : stock.map(item => (
                <TableRow key={item.codigo}>
                  <TableCell>
                    <p className="font-medium">{item.nombre}</p>
                    {item.descripcion && <p className="text-xs text-muted-foreground">{item.descripcion}</p>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={item.stockCamioneta <= 5 ? "destructive" : "secondary"}>
                      {item.stockCamioneta} {item.unidad}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{fmt(item.precioVenta)}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(item.precioVenta * item.stockCamioneta)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 justify-end">
                      <Button variant="outline" size="sm" className="text-blue-600 border-blue-300 hover:bg-blue-50 text-xs" onClick={() => handleDevolverClick(item)}>
                        <Undo2 className="w-3.5 h-3.5 mr-1" /> Devolver
                      </Button>
                      <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50 text-xs" onClick={() => onCaducado(item)}>
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Caducado
                      </Button>
                    </div>
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

      {/* ── Dialog: elegir cantidad a devolver ── */}
      <Dialog open={!!devolverItem && !credOpen} onOpenChange={open => { if (!open) setDevolverItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-blue-600" /> Devolver al depósito
            </DialogTitle>
          </DialogHeader>
          {devolverItem && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/40 rounded-lg">
                <p className="font-medium text-sm">{devolverItem.nombre}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Disponible en camioneta: <strong>{devolverItem.stockCamioneta} {devolverItem.unidad}</strong></p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Cantidad a devolver</label>
                <Input
                  type="number"
                  min={1}
                  max={devolverItem.stockCamioneta}
                  value={devolverCantidad}
                  onChange={e => setDevolverCantidad(e.target.value === "" ? "" : Number(e.target.value))}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">Máximo: {devolverItem.stockCamioneta}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDevolverItem(null)}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!devolverCantidad || Number(devolverCantidad) <= 0 || Number(devolverCantidad) > (devolverItem?.stockCamioneta ?? 0)}
              onClick={() => { setCredError(""); setCredOpen(true); }}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CredDialog
        open={credOpen}
        vendedor={vendedor}
        onOpenChange={open => { setCredOpen(open); if (!open) setCredError(""); }}
        onConfirm={handleCredConfirm}
        isPending={verifying}
        error={credError}
        titulo="Autorizar devolución"
      />
    </>
  );
}

// ─── Autocomplete genérico ────────────────────────────────────────────────────
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

interface ProductoItem { codigo: string; nombre: string; descripcion: string; stock: number }

function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, cb]);
}

function AutocompleteProducto({
  value, onChange, onSelect, productos, placeholder, required: req,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (p: ProductoItem) => void;
  productos: ProductoItem[];
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  const filtrados = value.trim().length > 0
    ? productos.filter(p => norm(p.nombre).includes(norm(value))).slice(0, 8)
    : [];

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (value.trim()) setOpen(true); }}
        placeholder={placeholder}
        autoComplete="off"
        required={req}
      />
      {open && filtrados.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtrados.map(p => (
            <button
              key={p.codigo}
              type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(p); onChange(p.nombre); setOpen(false); }}
            >
              <p className="text-sm font-medium leading-tight">{p.nombre}</p>
              {p.descripcion
                ? <p className="text-xs text-muted-foreground mt-0.5">{p.descripcion}</p>
                : <p className="text-xs text-muted-foreground/50 mt-0.5 italic">Sin descripción</p>
              }
              <p className="text-xs text-muted-foreground/70 mt-0.5">Stock depósito: {p.stock}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AutocompleteStock({
  value, onChange, onSelect, stock, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (item: StockItem) => void;
  stock: StockItem[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  const filtrados = value.trim().length > 0
    ? stock.filter(p => norm(p.nombre).includes(norm(value))).slice(0, 8)
    : stock.slice(0, 8);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtrados.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filtrados.map(item => (
            <button
              key={item.codigo}
              type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(item); onChange(""); setOpen(false); }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{item.nombre}</p>
                  {item.descripcion
                    ? <p className="text-xs text-muted-foreground mt-0.5">{item.descripcion}</p>
                    : <p className="text-xs text-muted-foreground/40 mt-0.5 italic">Sin descripción</p>
                  }
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-primary">{fmt(item.precioVenta)}</p>
                  <p className={`text-xs mt-0.5 ${item.stockCamioneta === 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {item.stockCamioneta} disp.
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pestaña: Cargar ──────────────────────────────────────────────────────────
function TabCargar({ vendedor }: { vendedor: Vendedor }) {
  const { toast } = useToast();
  const [items, setItems] = useState<CargaItem[]>([]);
  const [nombreInput, setNombreInput] = useState("");
  const [proveedorInput, setProveedorInput] = useState("");
  const [cantidadInput, setCantidadInput] = useState<number | "">("");
  const [credOpen, setCredOpen] = useState(false);
  const [credError, setCredError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const nombre = VENDEDORES.find(v => v.username === vendedor)?.nombre;

  const { data: todosProductos } = useQuery<{ codigo: string; nombre: string; descripcion: string; stock: number }[]>({
    queryKey: ["productos-lista"],
    queryFn: () => fetch("/api/productos", { credentials: "include" }).then(r => r.json()),
  });

  const productoPreview = todosProductos?.find(p => norm(p.nombre) === norm(nombreInput));

  const cargaMutation = useCargaMutation(vendedor, () => {
    toast({ title: `¡Camioneta de ${nombre} cargada exitosamente!` });
    setItems([]);
    setProveedorInput("");
  });

  const resolverCodigo = (nombreBuscado: string) => {
    const match = todosProductos?.find(p => norm(p.nombre) === norm(nombreBuscado));
    if (match) return { codigo: match.codigo, nombre: match.nombre };
    const base = nombreBuscado.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 16);
    return { codigo: base || "PROD" + Date.now(), nombre: nombreBuscado.trim() };
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cantidad = Number(cantidadInput);
    if (!nombreInput.trim() || !cantidad || cantidad <= 0) {
      toast({ title: "Completá el nombre y la cantidad", variant: "destructive" });
      return;
    }
    const { codigo, nombre: nombreResuelto } = resolverCodigo(nombreInput);
    const existing = items.find(i => i.productoCodigo === codigo);
    if (existing) {
      setItems(prev => prev.map(i => i.productoCodigo === codigo ? { ...i, cantidad: i.cantidad + cantidad } : i));
    } else {
      setItems(prev => [...prev, {
        productoCodigo: codigo,
        productoNombre: nombreResuelto,
        cantidad,
        proveedor: proveedorInput.trim(),
      }]);
    }
    setNombreInput("");
    setCantidadInput("");
  };

  const handleVerifyAndLoad = async (password: string) => {
    setVerifying(true);
    setCredError("");
    const result = await verificarCredenciales(vendedor, password);
    setVerifying(false);
    if (!result.ok) { setCredError(result.error!); return; }
    setCredOpen(false);
    cargaMutation.mutate(items);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="text-base">Agregar producto a la camioneta de {nombre}</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="mb-2">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Proveedor / Origen</label>
            <Input placeholder="Nombre del proveedor..." value={proveedorInput} onChange={e => setProveedorInput(e.target.value)} />
          </div>
          <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium">Agregar producto</h3>
            <form onSubmit={handleAddItem} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs text-muted-foreground mb-1 block">Nombre del producto</label>
                <AutocompleteProducto
                  value={nombreInput}
                  onChange={setNombreInput}
                  onSelect={p => setNombreInput(p.nombre)}
                  productos={todosProductos ?? []}
                  placeholder="Pan de sal..."
                />
                {productoPreview && (
                  <div className="mt-1.5 p-2 bg-primary/5 border border-primary/20 rounded text-xs space-y-0.5">
                    <p className="text-muted-foreground italic">
                      {productoPreview.descripcion || "Sin descripción"}
                    </p>
                    <p>Depósito: <strong className={productoPreview.stock === 0 ? "text-destructive" : "text-foreground"}>{productoPreview.stock} unidades</strong></p>
                  </div>
                )}
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground mb-1 block">Cantidad</label>
                <Input
                  type="number" min="1"
                  value={cantidadInput}
                  onChange={e => setCantidadInput(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0"
                  required
                />
              </div>
              <Button type="submit" variant="secondary" className="shrink-0 gap-1">
                <Plus className="w-4 h-4" /> Agregar
              </Button>
            </form>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-center">Cant.</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                    <Truck className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    Sin productos agregados
                  </TableCell>
                </TableRow>
              ) : items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium text-sm">{item.productoNombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.proveedor || "—"}</TableCell>
                  <TableCell className="text-center font-bold">{item.cantidad}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="text-base">Resumen de Carga</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Camioneta:</span>
              <span className="font-medium text-foreground">{nombre}</span>
            </div>
            <div className="flex justify-between">
              <span>Productos distintos:</span>
              <span>{items.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Unidades totales:</span>
              <span className="font-bold text-foreground">{items.reduce((s, i) => s + i.cantidad, 0)}</span>
            </div>
          </div>
          <Button
            className="w-full h-12 mt-2"
            onClick={() => {
              if (items.length === 0) { toast({ title: "Agregá productos primero", variant: "destructive" }); return; }
              setCredError("");
              setCredOpen(true);
            }}
            disabled={items.length === 0 || cargaMutation.isPending}
          >
            <Lock className="w-4 h-4 mr-2" />
            {cargaMutation.isPending ? "Cargando..." : "Confirmar Carga"}
          </Button>
        </CardContent>
      </Card>

      <CredDialog
        open={credOpen}
        vendedor={vendedor}
        onOpenChange={setCredOpen}
        onConfirm={handleVerifyAndLoad}
        isPending={verifying}
        error={credError}
        titulo="Autorizar carga de camioneta"
        descripcion="Ingresá la contraseña de desarrollador para confirmar"
      />
    </div>
  );
}

// ─── Pestaña: Venta en Ruta ───────────────────────────────────────────────────
function TabVentaRuta({ vendedor, stock, onCaducado }: { vendedor: Vendedor; stock: StockItem[] | undefined; onCaducado: (item: StockItem) => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [credOpen, setCredOpen] = useState(false);
  const [credError, setCredError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const nombre = VENDEDORES.find(v => v.username === vendedor)?.nombre;

  const ventaMutation = useVentaRutaMutation(vendedor, () => {
    toast({ title: "Venta en ruta registrada" });
    setCart([]);
  });

  const stockFiltrado = (stock ?? []).filter(item =>
    item.nombre.toLowerCase().includes(search.toLowerCase()) ||
    item.codigo.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (item: StockItem) => {
    setCart(prev => {
      const ex = prev.find(i => i.productoCodigo === item.codigo);
      const inCart = ex?.cantidad ?? 0;
      if (inCart >= item.stockCamioneta) {
        toast({ title: `Sin stock en camioneta para ${item.nombre}`, variant: "destructive" });
        return prev;
      }
      if (ex) return prev.map(i => i.productoCodigo === item.codigo ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { productoCodigo: item.codigo, productoNombre: item.nombre, cantidad: 1, precioUnitario: item.precioVenta }];
    });
  };

  const total = cart.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);

  const handleVerifyAndSell = async (password: string) => {
    setVerifying(true);
    setCredError("");
    const result = await verificarCredenciales(vendedor, password);
    setVerifying(false);
    if (!result.ok) { setCredError(result.error!); return; }
    setCredOpen(false);
    ventaMutation.mutate(cart.map(i => ({ productoCodigo: i.productoCodigo, cantidad: i.cantidad })));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader className="bg-primary/5 border-b pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" /> Productos de {nombre}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {!stock?.length ? (
            <p className="text-center py-8 text-muted-foreground">La camioneta de {nombre} está vacía. Cargá productos primero.</p>
          ) : (
            <>
              <AutocompleteStock
                value={search}
                onChange={setSearch}
                onSelect={item => addToCart(item)}
                stock={stock}
                placeholder="Buscar y agregar producto..."
              />
              {stockFiltrado.length === 0 && search.trim() ? (
                <p className="text-center py-4 text-muted-foreground text-sm">No se encontraron productos</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="text-base">Resumen de Venta</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2 min-h-[60px]">
            {cart.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Seleccioná productos de la lista</p>
            ) : cart.map(item => (
              <div key={item.productoCodigo} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.productoNombre}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-6 w-6"
                    onClick={() => setCart(c => c.map(i => i.productoCodigo === item.productoCodigo ? { ...i, cantidad: Math.max(0, i.cantidad - 1) } : i).filter(i => i.cantidad > 0))}>−</Button>
                  <span className="w-6 text-center text-sm font-bold">{item.cantidad}</span>
                  <Button variant="outline" size="icon" className="h-6 w-6"
                    onClick={() => { const s = stock?.find(s => s.codigo === item.productoCodigo); if (s) addToCart(s); }}>+</Button>
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
          <Button className="w-full" onClick={() => { setCredError(""); setCredOpen(true); }} disabled={cart.length === 0 || ventaMutation.isPending}>
            <CheckCircle className="w-4 h-4 mr-2" />
            {ventaMutation.isPending ? "Registrando..." : "Confirmar Venta"}
          </Button>
        </CardContent>
      </Card>

      <CredDialog
        open={credOpen}
        vendedor={vendedor}
        onOpenChange={setCredOpen}
        onConfirm={handleVerifyAndSell}
        isPending={verifying}
        error={credError}
        titulo="Confirmar venta en ruta"
      />
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
type Tab = "stock" | "cargar" | "venta";

export default function Camioneta() {
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<Vendedor>("david");
  const [tab, setTab] = useState<Tab>("stock");
  const { toast } = useToast();

  // ── Cambiar camioneta (requiere contraseña dev) ──
  const [devDialogOpen, setDevDialogOpen] = useState(false);
  const [devPassword, setDevPassword] = useState("");
  const [devError, setDevError] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);

  const { data: stock, isLoading } = useCamionetaStock(vendedorSeleccionado);

  const queryClient = useQueryClient();
  const [caducadoDialog, setCaducadoDialog] = useState<StockItem | null>(null);
  const [caducadoCantidad, setCaducadoCantidad] = useState<number | "">(1);
  const [credCaducadoOpen, setCredCaducadoOpen] = useState(false);
  const [credCaducadoError, setCredCaducadoError] = useState("");
  const [verifyingCaducado, setVerifyingCaducado] = useState(false);
  // Guardamos el item pendiente en estado separado para que no se pierda cuando
  // el AlertDialog se cierra automáticamente al hacer click en AlertDialogAction
  const [pendingCaducado, setPendingCaducado] = useState<{ productoCodigo: string; cantidad: number } | null>(null);

  const caducadoMutation = useCaducadoMutation(vendedorSeleccionado, () => {
    toast({ title: "Pérdida registrada correctamente" });
    setPendingCaducado(null);
    setCaducadoDialog(null);
    setCaducadoCantidad(1);
  });

  const handleCaducadoVerify = async (password: string) => {
    if (!pendingCaducado) return;
    setVerifyingCaducado(true);
    setCredCaducadoError("");
    const result = await verificarCredenciales(vendedorSeleccionado!, password);
    setVerifyingCaducado(false);
    if (!result.ok) { setCredCaducadoError(result.error!); return; }
    setCredCaducadoOpen(false);
    caducadoMutation.mutate(pendingCaducado);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "stock", label: "Mi Camioneta", icon: Truck },
    { id: "cargar", label: "Cargar", icon: ArrowDownToLine },
    { id: "venta", label: "Venta en Ruta", icon: ShoppingCart },
  ];

  const handleDevConfirm = () => {
    if (devPassword !== DEV_PASSWORD) { setDevError("Contraseña incorrecta"); return; }
    setDevDialogOpen(false);
    setDevPassword("");
    setDevError("");
    setSelectorOpen(true);
  };

  const nombreVendedor = VENDEDORES.find(v => v.username === vendedorSeleccionado)?.nombre;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Truck className="w-8 h-8 text-primary" /> Camioneta de {nombreVendedor}
        </h1>
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-muted-foreground gap-1"
          onClick={() => { setDevPassword(""); setDevError(""); setDevDialogOpen(true); }}
        >
          <Plus className="w-3.5 h-3.5" /> Otra camioneta
        </Button>
      </div>

      {/* Dialog: contraseña dev para cambiar camioneta */}
      <Dialog open={devDialogOpen} onOpenChange={open => { if (!open) { setDevDialogOpen(false); setDevPassword(""); setDevError(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" /> Acceso de desarrollador
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Ingresá la contraseña de desarrollador para cambiar de camioneta</p>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 text-xl tracking-widest"
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={devPassword}
                onChange={e => { setDevPassword(e.target.value); setDevError(""); }}
                onKeyDown={e => e.key === "Enter" && devPassword && handleDevConfirm()}
                autoFocus
              />
            </div>
            {devError && <p className="text-destructive text-sm bg-destructive/10 p-2 rounded">{devError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDevDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleDevConfirm} disabled={!devPassword}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: selector de camioneta (solo después de autenticar con dev) */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" /> Seleccionar camioneta
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {VENDEDORES.map(v => (
              <button
                key={v.username}
                onClick={() => { setVendedorSeleccionado(v.username); setTab("stock"); setSelectorOpen(false); }}
                className={`py-6 rounded-xl border-2 font-bold text-lg transition-all ${
                  vendedorSeleccionado === v.username
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:border-primary hover:bg-primary/5 hover:text-primary"
                }`}
              >
                {v.nombre}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex gap-2 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stock" && (
        <TabStock
          vendedor={vendedorSeleccionado}
          stock={stock}
          isLoading={isLoading}
          onCaducado={(item) => { setCaducadoDialog(item); setCaducadoCantidad(1); }}
        />
      )}
      {tab === "cargar" && <TabCargar vendedor={vendedorSeleccionado} />}
      {tab === "venta" && <TabVentaRuta vendedor={vendedorSeleccionado} stock={stock} onCaducado={(item) => { setCaducadoDialog(item); setCaducadoCantidad(1); }} />}

      {/* Diálogo caducado */}
      <AlertDialog open={!!caducadoDialog} onOpenChange={open => { if (!open) { setCaducadoDialog(null); setCaducadoCantidad(1); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar producto caducado</AlertDialogTitle>
            <AlertDialogDescription>
              {caducadoDialog?.nombre} — Stock a bordo: {caducadoDialog?.stockCamioneta}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium mb-1 block">¿Cuántas unidades se perdieron?</label>
            <Input
              type="number" min="1"
              value={caducadoCantidad}
              onChange={e => setCaducadoCantidad(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                if (!caducadoCantidad || Number(caducadoCantidad) <= 0) {
                  toast({ title: "Cantidad inválida", variant: "destructive" });
                  return;
                }
                // Guardamos el item ANTES de que el AlertDialog limpie caducadoDialog
                setPendingCaducado({ productoCodigo: caducadoDialog!.codigo, cantidad: Number(caducadoCantidad) });
                setCredCaducadoError("");
                setCredCaducadoOpen(true);
              }}
            >
              Confirmar pérdida
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {vendedorSeleccionado && (
        <CredDialog
          open={credCaducadoOpen}
          vendedor={vendedorSeleccionado}
          onOpenChange={setCredCaducadoOpen}
          onConfirm={handleCaducadoVerify}
          isPending={verifyingCaducado}
          error={credCaducadoError}
          titulo="Confirmar pérdida / caducado"
        />
      )}
    </div>
  );
}
