import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  useListarVentas, getListarVentasQueryKey,
  useRegistrarVenta,
  useListarProductos
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ShoppingCart, User, Plus, Trash2, Calendar, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface CartItem {
  productoCodigo: string;
  productoNombre: string;
  precioUnitario: number;
  cantidad: number;
  stockDisponible: number;
  subtotal: number;
}

export default function Ventas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // POS State
  const [vendedor, setVendedor] = useState("");
  const [codigoInput, setCodigoInput] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const codigoInputRef = useRef<HTMLInputElement>(null);

  // Filter State
  const [filtroVendedor, setFiltroVendedor] = useState("");

  const { data: productos } = useListarProductos();
  const { data: ventas, isLoading: isLoadingVentas } = useListarVentas(
    { vendedor: filtroVendedor || undefined },
    { query: { queryKey: getListarVentasQueryKey({ vendedor: filtroVendedor || undefined }) } }
  );

  const registrarVenta = useRegistrarVenta({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarVentasQueryKey() });
        toast({ title: "Venta registrada exitosamente" });
        setCart([]);
        setCodigoInput("");
      },
      onError: (err: any) => {
        toast({ title: "Error al registrar venta", description: err?.response?.data?.error || "Verifica los datos", variant: "destructive" });
      }
    }
  });

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);

  const handleAddProduct = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!codigoInput.trim()) return;

    const producto = productos?.find(p => p.codigo.toLowerCase() === codigoInput.toLowerCase());
    
    if (!producto) {
      toast({ title: "Producto no encontrado", variant: "destructive" });
      return;
    }

    if (producto.stock <= 0) {
      toast({ title: "Stock agotado", description: `${producto.nombre} no tiene stock disponible.`, variant: "destructive" });
      return;
    }

    const existingItem = cart.find(item => item.productoCodigo === producto.codigo);
    
    if (existingItem) {
      if (existingItem.cantidad >= producto.stock) {
        toast({ title: "Stock insuficiente", description: `Solo hay ${producto.stock} disponibles.`, variant: "destructive" });
        return;
      }
      setCart(cart.map(item => 
        item.productoCodigo === producto.codigo 
          ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precioUnitario }
          : item
      ));
    } else {
      setCart([...cart, {
        productoCodigo: producto.codigo,
        productoNombre: producto.nombre,
        precioUnitario: producto.precioVenta,
        cantidad: 1,
        stockDisponible: producto.stock,
        subtotal: producto.precioVenta
      }]);
    }
    
    setCodigoInput("");
    if (codigoInputRef.current) codigoInputRef.current.focus();
  };

  const updateItemQuantity = (codigo: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.productoCodigo === codigo) {
        const newQty = Math.max(1, Math.min(item.cantidad + delta, item.stockDisponible));
        return { ...item, cantidad: newQty, subtotal: newQty * item.precioUnitario };
      }
      return item;
    }));
  };

  const removeItem = (codigo: string) => {
    setCart(cart.filter(item => item.productoCodigo !== codigo));
  };

  const handleConfirmSale = () => {
    if (!vendedor.trim()) {
      toast({ title: "Falta vendedor", description: "Ingresa el nombre del vendedor.", variant: "destructive" });
      return;
    }
    if (cart.length === 0) {
      toast({ title: "Carrito vacío", description: "Agrega al menos un producto.", variant: "destructive" });
      return;
    }

    registrarVenta.mutate({
      data: {
        vendedor,
        items: cart.map(item => ({
          productoCodigo: item.productoCodigo,
          cantidad: item.cantidad
        }))
      }
    });
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
        <ShoppingCart className="w-8 h-8 text-primary" />
        Punto de Venta
      </h1>

      {/* POS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-primary/20 shadow-md">
          <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Nueva Venta
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex gap-4">
              <div className="w-1/3">
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Vendedor</label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Nombre..." 
                    className="pl-8 bg-background border-border"
                    value={vendedor}
                    onChange={(e) => setVendedor(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Agregar Producto</label>
                <form onSubmit={handleAddProduct} className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      ref={codigoInputRef}
                      placeholder="Escanea o escribe el código y presiona Enter..." 
                      className="pl-8 bg-background border-border font-mono"
                      value={codigoInput}
                      onChange={(e) => setCodigoInput(e.target.value)}
                    />
                  </div>
                  <Button type="submit" variant="secondary">Agregar</Button>
                </form>
              </div>
            </div>

            <div className="rounded-md border border-border overflow-hidden bg-background">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[100px]">Cód</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-center w-[150px]">Cant.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground h-[200px]">
                        El carrito está vacío.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cart.map(item => (
                      <TableRow key={item.productoCodigo} className="group">
                        <TableCell className="font-mono text-xs">{item.productoCodigo}</TableCell>
                        <TableCell className="font-medium">{item.productoNombre}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.precioUnitario)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItemQuantity(item.productoCodigo, -1)}>-</Button>
                            <span className="w-8 text-center font-medium">{item.cantidad}</span>
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItemQuantity(item.productoCodigo, 1)}>+</Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(item.subtotal)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem(item.productoCodigo)}>
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

        <Card className="bg-card flex flex-col justify-between shadow-md border-border">
          <CardHeader className="bg-muted/30 pb-4 border-b border-border">
            <CardTitle className="text-lg">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col justify-center">
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-muted-foreground">
                <span>Items:</span>
                <span>{cart.reduce((s, i) => s + i.cantidad, 0)}</span>
              </div>
              <div className="flex justify-between text-2xl font-bold text-foreground">
                <span>Total:</span>
                <span className="text-primary">{formatCurrency(cartTotal)}</span>
              </div>
            </div>
            
            <Button 
              className="w-full h-14 text-lg" 
              size="lg" 
              onClick={handleConfirmSale}
              disabled={cart.length === 0 || registrarVenta.isPending}
            >
              {registrarVenta.isPending ? "Procesando..." : "Confirmar Venta"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* HISTORY SECTION */}
      <div className="mt-12">
        <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">Historial de Ventas</h2>
        <div className="flex mb-4">
          <div className="relative w-64">
            <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filtrar por vendedor..." 
              className="pl-8 bg-card"
              value={filtroVendedor}
              onChange={(e) => setFiltroVendedor(e.target.value)}
            />
          </div>
        </div>

        <Card>
          <div className="rounded-md border-0 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ganancia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingVentas ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell></TableRow>
                ) : ventas?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay ventas registradas.</TableCell></TableRow>
                ) : (
                  ventas?.map((venta) => (
                    <TableRow key={venta.id}>
                      <TableCell className="font-mono text-xs">#{venta.id.toString().padStart(4, '0')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span>{format(parseISO(venta.fecha), "dd MMM yyyy, HH:mm", { locale: es })}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{venta.vendedor}</TableCell>
                      <TableCell>
                        <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full">
                          {venta.items?.length || 0} prod.
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(venta.total)}</TableCell>
                      <TableCell className="text-right text-primary font-medium">{formatCurrency(venta.ganancia)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}