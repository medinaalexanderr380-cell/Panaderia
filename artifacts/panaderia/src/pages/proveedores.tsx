import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  useListarProveedores, getListarProveedoresQueryKey,
  useCrearProveedor,
  useActualizarProveedor,
  useEliminarProveedor,
  useObtenerResumenProveedor, getObtenerResumenProveedorQueryKey,
  useObtenerProductosPorProveedor, getObtenerProductosPorProveedorQueryKey
} from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Search, Users, Phone, Mail, Building2, Package, TrendingUp, ChevronRight, ShoppingBag, Calendar, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

const proveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  contacto: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional().default(""),
  direccion: z.string().optional(),
  notas: z.string().optional(),
});

type ProveedorFormValues = z.infer<typeof proveedorSchema>;

export default function Proveedores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedProveedorId, setSelectedProveedorId] = useState<number | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: proveedores, isLoading } = useListarProveedores();

  const form = useForm<ProveedorFormValues>({
    resolver: zodResolver(proveedorSchema),
    defaultValues: { nombre: "", contacto: "", telefono: "", email: "", direccion: "", notas: "" }
  });

  const crearMutation = useCrearProveedor({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarProveedoresQueryKey() });
        toast({ title: "Proveedor creado" });
        setIsDialogOpen(false);
        form.reset();
      }
    }
  });

  const actualizarMutation = useActualizarProveedor({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarProveedoresQueryKey() });
        toast({ title: "Proveedor actualizado" });
        setIsDialogOpen(false);
        setEditingId(null);
        form.reset();
      }
    }
  });

  const eliminarMutation = useEliminarProveedor({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarProveedoresQueryKey() });
        toast({ title: "Proveedor eliminado" });
      }
    }
  });

  const onSubmit = (data: ProveedorFormValues) => {
    if (editingId) {
      actualizarMutation.mutate({ id: editingId, data });
    } else {
      crearMutation.mutate({ data });
    }
  };

  const handleEdit = (proveedor: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(proveedor.id);
    form.reset({
      nombre: proveedor.nombre,
      contacto: proveedor.contacto || "",
      telefono: proveedor.telefono || "",
      email: proveedor.email || "",
      direccion: proveedor.direccion || "",
      notas: proveedor.notas || ""
    });
    setIsDialogOpen(true);
  };

  const filteredProveedores = proveedores?.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.contacto && p.contacto.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Users className="w-8 h-8 text-primary" />
          Directorio de Proveedores
        </h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) { setEditingId(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button>Nuevo Proveedor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="nombre" render={({ field }) => (
                  <FormItem><FormLabel>Nombre Comercial</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="contacto" render={({ field }) => (
                  <FormItem><FormLabel>Nombre de Contacto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="telefono" render={({ field }) => (
                    <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="direccion" render={({ field }) => (
                  <FormItem><FormLabel>Dirección</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={crearMutation.isPending || actualizarMutation.isPending}>Guardar</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative w-full md:w-96">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar proveedores..." 
          className="pl-8 bg-card"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">Cargando...</div>
        ) : filteredProveedores?.length === 0 ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">No se encontraron proveedores.</div>
        ) : (
          filteredProveedores?.map(proveedor => (
            <Card 
              key={proveedor.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors group relative overflow-hidden"
              onClick={() => setSelectedProveedorId(proveedor.id)}
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                      {proveedor.nombre}
                    </CardTitle>
                    {proveedor.contacto && <CardDescription className="mt-1">{proveedor.contacto}</CardDescription>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleEdit(proveedor, e)}>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" /> {proveedor.telefono || "-"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" /> <span className="truncate">{proveedor.email || "-"}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ProveedorDetalleSheet 
        proveedorId={selectedProveedorId} 
        onClose={() => setSelectedProveedorId(null)} 
      />
    </div>
  );
}

function ProveedorDetalleSheet({ proveedorId, onClose }: { proveedorId: number | null, onClose: () => void }) {
  const [expandedCompra, setExpandedCompra] = useState<number | null>(null);

  const { data: resumen } = useObtenerResumenProveedor(proveedorId!, { 
    query: { enabled: !!proveedorId, queryKey: getObtenerResumenProveedorQueryKey(proveedorId!) } 
  });
  
  const { data: productos } = useObtenerProductosPorProveedor(proveedorId!, {
    query: { enabled: !!proveedorId, queryKey: getObtenerProductosPorProveedorQueryKey(proveedorId!) }
  });

  const { data: comprasProveedor } = useQuery<any[]>({
    queryKey: ["proveedor-compras", proveedorId],
    queryFn: () => fetch(`/api/proveedores/${proveedorId}/compras`, { credentials: "include" }).then(r => r.json()),
    enabled: !!proveedorId,
  });

  return (
    <Sheet open={!!proveedorId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg overflow-y-auto pb-12">
        {resumen ? (
          <>
            <SheetHeader className="mb-6">
              <SheetTitle className="text-2xl flex items-center gap-2">
                <Building2 className="text-primary" />
                {resumen.proveedorNombre}
              </SheetTitle>
              <SheetDescription>Detalle y métricas del proveedor</SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-3 gap-3 mb-8">
              <Card className="bg-primary/5 border-primary/10 shadow-none">
                <CardContent className="p-3 flex flex-col items-center justify-center text-center">
                  <TrendingUp className="w-5 h-5 text-primary mb-1" />
                  <span className="text-lg font-bold">{formatCurrency(resumen.totalInvertido)}</span>
                  <span className="text-xs text-muted-foreground">Invertido</span>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-border shadow-none">
                <CardContent className="p-3 flex flex-col items-center justify-center text-center">
                  <Package className="w-5 h-5 text-muted-foreground mb-1" />
                  <span className="text-lg font-bold">{resumen.totalProductos}</span>
                  <span className="text-xs text-muted-foreground">Productos</span>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-border shadow-none">
                <CardContent className="p-3 flex flex-col items-center justify-center text-center">
                  <ShoppingBag className="w-5 h-5 text-muted-foreground mb-1" />
                  <span className="text-lg font-bold">{comprasProveedor?.length ?? 0}</span>
                  <span className="text-xs text-muted-foreground">Compras</span>
                </CardContent>
              </Card>
            </div>

            {/* Productos del proveedor */}
            {(productos?.length ?? 0) > 0 && (
              <div className="space-y-3 mb-6">
                <h3 className="font-semibold flex items-center gap-2 border-b pb-2">
                  <Package className="w-4 h-4" /> Productos de este proveedor
                </h3>
                <div className="space-y-2">
                  {productos?.map(prod => (
                    <div key={prod.id} className="flex justify-between items-center p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
                      <div>
                        <p className="font-medium text-sm flex items-center gap-2">
                          {prod.nombre}
                          {prod.stock <= prod.stockMinimo && <Badge variant="destructive" className="text-[10px] px-1 py-0">Stock bajo</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Stock: {prod.stock} {prod.unidad}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(prod.precioCosto)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Costo unit.</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historial de compras */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2 border-b pb-2">
                <ShoppingBag className="w-4 h-4" /> Historial de compras
              </h3>
              {!comprasProveedor?.length ? (
                <p className="text-muted-foreground text-sm italic">Sin compras registradas para este proveedor.</p>
              ) : (
                <div className="space-y-2">
                  {comprasProveedor.map((compra: any) => {
                    const isOpen = expandedCompra === compra.id;
                    const fechaLabel = format(parseISO(compra.fecha.split("T")[0]), "dd 'de' MMM yyyy", { locale: es });
                    return (
                      <div key={compra.id} className="border rounded-lg overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
                          onClick={() => setExpandedCompra(isOpen ? null : compra.id)}
                        >
                          <div className="flex items-center gap-2">
                            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            <span className="text-sm font-medium">{fechaLabel}</span>
                            <span className="text-xs text-muted-foreground">· {compra.items?.length ?? 0} productos</span>
                          </div>
                          <span className="text-sm font-bold text-primary">{formatCurrency(compra.totalInvertido)}</span>
                        </button>
                        {isOpen && compra.items?.length > 0 && (
                          <div className="border-t bg-muted/10 p-3 space-y-1.5">
                            {compra.items.map((item: any, i: number) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span>{item.productoNombre} <span className="text-muted-foreground">×{item.cantidad}</span></span>
                                <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">Cargando...</div>
        )}
      </SheetContent>
    </Sheet>
  );
}