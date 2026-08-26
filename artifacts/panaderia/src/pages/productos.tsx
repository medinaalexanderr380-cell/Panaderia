import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  useListarProductos, getListarProductosQueryKey,
  useCrearProducto,
  useActualizarProducto,
  useEliminarProducto,
  useListarProveedores,
  useRegistrarCompra,
} from "@workspace/api-client-react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Package, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const generarCodigo = (nombre: string) => {
  const base = nombre.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 16);
  return base || "PROD" + Date.now();
};

const productoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional().default(""),
  precioVenta: z.coerce.number().min(0, "Debe ser mayor o igual a 0"),
  precioCosto: z.coerce.number().min(0, "Debe ser mayor o igual a 0"),
  stock: z.coerce.number().min(0, "Debe ser mayor o igual a 0"),
  stockMinimo: z.coerce.number().min(0, "Debe ser mayor o igual a 0"),
  unidad: z.string().default("unidades"),
  proveedorNombre: z.string().min(1, "El proveedor es requerido")
});

type ProductoFormValues = z.infer<typeof productoSchema>;

export default function Productos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<any>(null);
  const [comprandoProducto, setComprandoProducto] = useState<any>(null);
  const [compraProveedor, setCompraProveedor] = useState("");
  const [compraCantidad, setCompraCantidad] = useState<number | "">(1);
  const [compraCosto, setCompraCosto] = useState<number | "">(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: productos, isLoading } = useListarProductos();
  const { data: proveedores } = useListarProveedores();

  const form = useForm<ProductoFormValues>({
    resolver: zodResolver(productoSchema),
    defaultValues: {
      nombre: "",
      descripcion: "",
      precioVenta: 0,
      precioCosto: 0,
      stock: 0,
      stockMinimo: 0,
      unidad: "unidades",
      proveedorNombre: ""
    }
  });

  const crearMutation = useCrearProducto({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarProductosQueryKey() });
        toast({ title: "Producto creado exitosamente" });
        setIsDialogOpen(false);
        form.reset();
      },
      onError: () => toast({ title: "Error al crear producto", variant: "destructive" })
    }
  });

  const actualizarMutation = useActualizarProducto({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarProductosQueryKey() });
        toast({ title: "Producto actualizado exitosamente" });
        setIsDialogOpen(false);
        setEditingProducto(null);
        form.reset();
      },
      onError: () => toast({ title: "Error al actualizar producto", variant: "destructive" })
    }
  });

  const eliminarMutation = useEliminarProducto({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarProductosQueryKey() });
        toast({ title: "Producto eliminado" });
      },
      onError: (error: any) => toast({
        title: "No se puede eliminar el producto",
        description: error?.data?.error || error?.response?.data?.error || "Ocurrió un error inesperado",
        variant: "destructive",
      })
    }
  });

  const compraMutation = useRegistrarCompra({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarProductosQueryKey() });
        toast({ title: "Compra registrada", description: `Stock de ${comprandoProducto?.nombre} actualizado.` });
        setComprandoProducto(null);
        setCompraProveedor("");
        setCompraCantidad(1);
        setCompraCosto(0);
      },
      onError: (err: any) => toast({ title: "Error al registrar compra", description: err?.response?.data?.error, variant: "destructive" })
    }
  });

  const handleComprar = (e: React.FormEvent) => {
    e.preventDefault();
    const cantidad = Number(compraCantidad);
    const costo = Number(compraCosto);
    if (!compraProveedor.trim() || !cantidad || cantidad <= 0) {
      toast({ title: "Completá proveedor y cantidad", variant: "destructive" });
      return;
    }
    compraMutation.mutate({
      data: {
        proveedor: compraProveedor.trim(),
        items: [{ productoCodigo: comprandoProducto.codigo, cantidad, precioCosto: costo }]
      }
    });
  };

  const resolverProveedorId = (nombre: string) => {
    const match = proveedores?.find(p => p.nombre.toLowerCase() === nombre.toLowerCase());
    return match?.id ?? undefined;
  };

  const onSubmit = (data: ProductoFormValues) => {
    const { proveedorNombre, ...rest } = data;
    const proveedorId = resolverProveedorId(proveedorNombre);
    if (editingProducto) {
      actualizarMutation.mutate({ codigo: editingProducto.codigo, data: { ...rest, proveedorId } });
    } else {
      crearMutation.mutate({ data: { ...rest, codigo: generarCodigo(data.nombre), proveedorId } });
    }
  };

  const handleEdit = (producto: any) => {
    setEditingProducto(producto);
    form.reset({
      nombre: producto.nombre,
      descripcion: producto.descripcion || "",
      precioVenta: Number(producto.precioVenta),
      precioCosto: Number(producto.precioCosto),
      stock: Number(producto.stock),
      stockMinimo: producto.stockMinimo,
      unidad: producto.unidad,
      proveedorNombre: producto.proveedorNombre || ""
    });
    setIsDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingProducto(null);
      form.reset();
    }
  };

  const filteredProductos = productos?.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Package className="w-8 h-8 text-primary" />
          Catálogo de Productos
        </h1>
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingProducto ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Nombre</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Descripción</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="precioCosto"
                  render={({ field }) => (
                    <FormItem className="col-span-1">
                      <FormLabel>Precio Costo</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="precioVenta"
                  render={({ field }) => (
                    <FormItem className="col-span-1">
                      <FormLabel>Precio Venta</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stockMinimo"
                  render={({ field }) => (
                    <FormItem className="col-span-1">
                      <FormLabel>Stock Mínimo (alerta)</FormLabel>
                      <FormControl><Input type="number" min="0" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="proveedorNombre"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Proveedor <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          list="proveedores-list"
                          placeholder="Nombre del proveedor..."
                        />
                      </FormControl>
                      <datalist id="proveedores-list">
                        {proveedores?.map(p => <option key={p.id} value={p.nombre} />)}
                      </datalist>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="col-span-2 flex justify-end gap-2 mt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={crearMutation.isPending || actualizarMutation.isPending}>
                    {editingProducto ? "Guardar Cambios" : "Crear Producto"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nombre o código..." 
            className="pl-8 bg-card"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Precio/Costo</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell></TableRow>
            ) : filteredProductos?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No se encontraron productos.</TableCell></TableRow>
            ) : (
              filteredProductos?.map((producto) => (
                <TableRow key={producto.id}>
                  <TableCell>
                    <div className="font-medium">{producto.nombre}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{producto.descripcion}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-primary">{formatCurrency(producto.precioVenta)}</div>
                    <div className="text-xs text-muted-foreground">Costo: {formatCurrency(producto.precioCosto)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${producto.stock <= producto.stockMinimo ? "text-destructive" : ""}`}>
                        {producto.stock} {producto.unidad}
                      </span>
                      {producto.stock <= producto.stockMinimo && (
                        <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">Bajo</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {producto.proveedorNombre ? (
                      <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground border-secondary/20">
                        {producto.proveedorNombre}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost" size="icon"
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        title="Registrar compra"
                        onClick={() => {
                          setComprandoProducto(producto);
                          setCompraProveedor(producto.proveedorNombre || "");
                          setCompraCantidad(1);
                          setCompraCosto(Number(producto.precioCosto));
                        }}
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(producto)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará permanentemente "{producto.nombre}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => eliminarMutation.mutate({ codigo: producto.codigo })}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Diálogo compra rápida */}
      <Dialog open={!!comprandoProducto} onOpenChange={open => { if (!open) setComprandoProducto(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              Registrar compra
            </DialogTitle>
          </DialogHeader>
          {comprandoProducto && (
            <form onSubmit={handleComprar} className="space-y-4 pt-2">
              <p className="text-sm font-medium text-muted-foreground">
                Producto: <span className="text-foreground">{comprandoProducto.nombre}</span>
              </p>
              <div>
                <label className="text-sm font-medium mb-1 block">Proveedor</label>
                <Input
                  list="proveedores-compra-list"
                  value={compraProveedor}
                  onChange={e => setCompraProveedor(e.target.value)}
                  placeholder="Nombre del proveedor..."
                  required
                />
                <datalist id="proveedores-compra-list">
                  {proveedores?.map(p => <option key={p.id} value={p.nombre} />)}
                </datalist>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Cantidad comprada</label>
                <Input
                  type="number" min="1"
                  value={compraCantidad}
                  onChange={e => setCompraCantidad(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Costo unitario $</label>
                <Input
                  type="number" min="0" step="0.01"
                  value={compraCosto}
                  onChange={e => setCompraCosto(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setComprandoProducto(null)}>Cancelar</Button>
                <Button type="submit" disabled={compraMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                  {compraMutation.isPending ? "Guardando..." : "Confirmar compra"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
