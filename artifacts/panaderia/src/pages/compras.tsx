import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  useListarProveedores,
  useListarCompras, getListarComprasQueryKey,
  useRegistrarCompra,
  useCrearProveedor
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, Plus, Trash2, Search, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface CompraItem {
  productoCodigo: string;
  productoNombre: string;
  cantidad: number;
  precioCosto: number;
  subtotal: number;
}

export default function Compras() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState("");
  const [nuevoProveedorNombre, setNuevoProveedorNombre] = useState("");
  const [items, setItems] = useState<CompraItem[]>([]);
  
  const [codigoInput, setCodigoInput] = useState("");
  const [nombreInput, setNombreInput] = useState("");
  const [cantidadInput, setCantidadInput] = useState(1);
  const [costoInput, setCostoInput] = useState(0);

  const { data: proveedores } = useListarProveedores();
  const { data: compras, isLoading: isLoadingCompras } = useListarCompras({}, {
    query: { queryKey: getListarComprasQueryKey({}) }
  });

  const crearProveedor = useCrearProveedor();
  const registrarCompra = useRegistrarCompra({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarComprasQueryKey({}) });
        toast({ title: "Compra registrada exitosamente" });
        setItems([]);
        setProveedorSeleccionado("");
        setNuevoProveedorNombre("");
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
      toast({ title: "Datos inválidos", description: "Completa todos los campos del producto correctamente.", variant: "destructive" });
      return;
    }

    const newItem: CompraItem = {
      productoCodigo: codigoInput,
      productoNombre: nombreInput,
      cantidad: cantidadInput,
      precioCosto: costoInput,
      subtotal: cantidadInput * costoInput
    };

    setItems([...items, newItem]);
    setCodigoInput("");
    setNombreInput("");
    setCantidadInput(1);
    setCostoInput(0);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleConfirmarCompra = async () => {
    let proveedorFinal = proveedorSeleccionado || nuevoProveedorNombre;
    
    if (!proveedorFinal.trim()) {
      toast({ title: "Falta proveedor", description: "Selecciona o ingresa un proveedor.", variant: "destructive" });
      return;
    }
    
    if (items.length === 0) {
      toast({ title: "Sin productos", description: "Agrega al menos un producto a la compra.", variant: "destructive" });
      return;
    }

    // If it's a new supplier typed in (doesn't match any existing), optionally create it.
    // For simplicity, the backend registrarCompra just takes a string 'proveedor'. 
    // Wait, the API spec says `proveedor: string`. So we just pass the string.

    registrarCompra.mutate({
      data: {
        proveedor: proveedorFinal,
        items: items.map(i => ({
          productoCodigo: i.productoCodigo,
          cantidad: i.cantidad,
          precioCosto: i.precioCosto
        }))
      }
    });
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
        <Truck className="w-8 h-8 text-primary" />
        Registro de Compras
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border shadow-md">
          <CardHeader className="bg-muted/30 pb-4 border-b border-border">
            <CardTitle className="text-lg">Nueva Compra</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Proveedor</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input 
                      placeholder="Escribe el nombre del proveedor..." 
                      value={proveedorSeleccionado || nuevoProveedorNombre}
                      onChange={(e) => {
                        setProveedorSeleccionado("");
                        setNuevoProveedorNombre(e.target.value);
                      }}
                      list="proveedores-list"
                    />
                    <datalist id="proveedores-list">
                      {proveedores?.map(p => (
                        <option key={p.id} value={p.nombre} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4 space-y-4">
                <h3 className="font-medium text-sm">Agregar Producto</h3>
                <form onSubmit={handleAddItem} className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-xs text-muted-foreground mb-1 block">Código</label>
                    <Input value={codigoInput} onChange={e => setCodigoInput(e.target.value)} required />
                  </div>
                  <div className="flex-[2] min-w-[150px]">
                    <label className="text-xs text-muted-foreground mb-1 block">Nombre (o Nuevo)</label>
                    <Input value={nombreInput} onChange={e => setNombreInput(e.target.value)} required />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-muted-foreground mb-1 block">Costo Un.</label>
                    <Input type="number" step="0.01" min="0" value={costoInput} onChange={e => setCostoInput(Number(e.target.value))} required />
                  </div>
                  <div className="w-20">
                    <label className="text-xs text-muted-foreground mb-1 block">Cant.</label>
                    <Input type="number" min="1" value={cantidadInput} onChange={e => setCantidadInput(Number(e.target.value))} required />
                  </div>
                  <Button type="submit" variant="secondary" className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </form>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-center">Cant.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">Sin productos</TableCell></TableRow>
                  ) : items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{item.productoCodigo}</TableCell>
                      <TableCell>{item.productoNombre}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.precioCosto)}</TableCell>
                      <TableCell className="text-center">{item.cantidad}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.subtotal)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
          </CardContent>
        </Card>

        <Card className="bg-card flex flex-col justify-between shadow-md border-border h-fit">
          <CardHeader className="bg-muted/30 pb-4 border-b border-border">
            <CardTitle className="text-lg">Resumen de Compra</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-muted-foreground">
                <span>Proveedor:</span>
                <span className="font-medium text-foreground text-right max-w-[150px] truncate">{proveedorSeleccionado || nuevoProveedorNombre || "-"}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Items distintos:</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Unidades totales:</span>
                <span>{items.reduce((s,i) => s + i.cantidad, 0)}</span>
              </div>
              <div className="pt-4 border-t border-border mt-4 flex justify-between text-2xl font-bold text-foreground">
                <span>Total:</span>
                <span className="text-primary">{formatCurrency(totalCompra)}</span>
              </div>
            </div>
            
            <Button 
              className="w-full h-12" 
              onClick={handleConfirmarCompra}
              disabled={items.length === 0 || !(proveedorSeleccionado || nuevoProveedorNombre) || registrarCompra.isPending}
            >
              {registrarCompra.isPending ? "Procesando..." : "Registrar Compra"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* HISTORY SECTION */}
      <div className="mt-12">
        <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">Historial de Compras</h2>
        <Card>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Inversión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingCompras ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell></TableRow>
              ) : compras?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay compras registradas.</TableCell></TableRow>
              ) : (
                compras?.map((compra) => (
                  <TableRow key={compra.id}>
                    <TableCell className="font-mono text-xs">#{compra.id.toString().padStart(4, '0')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span>{format(parseISO(compra.fecha), "dd MMM yyyy", { locale: es })}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{compra.proveedor}</TableCell>
                    <TableCell>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md border border-border">
                        {compra.items?.length || 0} prod.
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(compra.totalInvertido)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}