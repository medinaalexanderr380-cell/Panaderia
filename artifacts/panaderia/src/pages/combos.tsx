import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListarCombos, getListarCombosQueryKey,
  useCrearCombo,
  useListarProductos,
  useEliminarCombo
} from "@workspace/api-client-react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers, Plus, Search, X, PackagePlus, Info, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

const comboSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().optional().default(""),
  precioVenta: z.coerce.number().min(0, "Debe ser mayor o igual a 0"),
  items: z.array(z.object({
    productoCodigo: z.string().min(1, "Requerido"),
    cantidad: z.coerce.number().min(1, "Mínimo 1")
  })).min(1, "Agregá al menos un producto")
});

type ComboFormValues = z.infer<typeof comboSchema>;

export default function Combos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [selectedQty, setSelectedQty] = useState<number | "">(1);
  const [comboToDelete, setComboToDelete] = useState<{ id: number; nombre: string } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: combos, isLoading: isLoadingCombos } = useListarCombos();
  const { data: productos, isLoading: isLoadingProductos } = useListarProductos();

  const form = useForm<ComboFormValues>({
    resolver: zodResolver(comboSchema),
    defaultValues: {
      nombre: "",
      descripcion: "",
      precioVenta: 0,
      items: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const watchItems = form.watch("items") || [];
  const precioVenta = form.watch("precioVenta") || 0;

  const productSuggestions = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    const available = (productos ?? []).filter(product =>
      !watchItems.some(item => item.productoCodigo === product.codigo),
    );
    if (!query) return available.slice(0, 8);
    return available
      .filter(product =>
        product.nombre.toLowerCase().includes(query) ||
        product.codigo.toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [productSearch, productos, watchItems]);

  const valorNormal = useMemo(() => {
    return watchItems.reduce((total, item) => {
      const prod = productos?.find(p => p.codigo === item.productoCodigo);
      return total + ((prod?.precioVenta || 0) * (item.cantidad || 0));
    }, 0);
  }, [watchItems, productos]);

  const crearMutation = useCrearCombo({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarCombosQueryKey() });
        toast({ title: "Combo creado exitosamente" });
        setIsDialogOpen(false);
        form.reset();
        setSelectedProduct("");
        setProductSearch("");
        setShowProductSuggestions(false);
        setSelectedQty(1);
      },
      onError: (error: any) => {
        toast({ 
          title: "Error al crear combo", 
          description: error?.response?.data?.error || "Ocurrió un error inesperado",
          variant: "destructive" 
        });
      }
    }
  });

  const eliminarMutation = useEliminarCombo({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListarCombosQueryKey() });
        toast({ title: "Combo eliminado" });
        setComboToDelete(null);
      },
      onError: (error: any) => {
        toast({
          title: "Error al eliminar combo",
          description: error?.response?.data?.error || "Ocurrió un error inesperado",
          variant: "destructive",
        });
      },
    },
  });

  const onSubmit = (data: ComboFormValues) => {
    crearMutation.mutate({ data });
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      form.reset();
      setSelectedProduct("");
      setProductSearch("");
      setShowProductSuggestions(false);
      setSelectedQty(1);
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct || !selectedQty || selectedQty < 1) return;
    
    const existingIndex = watchItems.findIndex(i => i.productoCodigo === selectedProduct);
    if (existingIndex >= 0) {
      const current = watchItems[existingIndex].cantidad;
      form.setValue(`items.${existingIndex}.cantidad`, current + Number(selectedQty));
    } else {
      append({ productoCodigo: selectedProduct, cantidad: Number(selectedQty) });
    }
    
    setSelectedProduct("");
    setProductSearch("");
    setShowProductSuggestions(false);
    setSelectedQty(1);
  };

  const handleSelectProduct = (producto: { codigo: string; nombre: string }) => {
    setSelectedProduct(producto.codigo);
    setProductSearch(producto.nombre);
    setShowProductSuggestions(false);
  };

  const filteredCombos = combos?.filter(c =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Layers className="w-8 h-8 text-primary" />
          Combos y Promociones
        </h1>
        
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Combo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <PackagePlus className="w-6 h-6 text-primary" />
                Crear Nuevo Combo
              </DialogTitle>
              <DialogDescription>
                Elegí los productos y cantidades que formarán parte de la promoción.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Combo <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input placeholder="Ej: Desayuno Clásico..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl><Input placeholder="Breve detalle..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* PRODUCT SELECTION */}
                <div className="bg-sidebar rounded-xl border border-border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Layers className="w-4 h-4 text-muted-foreground" />
                      Productos Incluidos
                    </h3>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
                    <div className="flex-1 w-full space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Producto</label>
                      <div className="relative">
                        <Input
                          value={productSearch}
                          placeholder={isLoadingProductos ? "Cargando..." : "Escribí el nombre del producto..."}
                          disabled={isLoadingProductos}
                          onFocus={() => setShowProductSuggestions(true)}
                          onChange={e => {
                            setProductSearch(e.target.value);
                            setSelectedProduct("");
                            setShowProductSuggestions(true);
                          }}
                          autoComplete="off"
                        />
                        {showProductSuggestions && productSuggestions.length > 0 && (
                          <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                            {productSuggestions.map(producto => (
                              <button
                                key={producto.codigo}
                                type="button"
                                className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => handleSelectProduct(producto)}
                              >
                                <span className="font-medium">{producto.nombre}</span>
                                <span className="ml-3 shrink-0 text-xs text-muted-foreground">{formatCurrency(producto.precioVenta)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {showProductSuggestions && productSearch.trim() && productSuggestions.length === 0 && (
                          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover p-3 text-sm text-muted-foreground shadow-md">
                            No hay productos que coincidan.
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-full sm:w-24 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Cant.</label>
                      <Input 
                        type="number" 
                        min="1" 
                        value={selectedQty} 
                        onChange={e => setSelectedQty(e.target.value === "" ? "" : Number(e.target.value))} 
                      />
                    </div>
                    <Button 
                      type="button" 
                      onClick={handleAddItem} 
                      variant="secondary"
                      className="w-full sm:w-auto"
                      disabled={!selectedProduct || !selectedQty || selectedQty < 1}
                    >
                      Añadir
                    </Button>
                  </div>

                  {/* ITEMS LIST */}
                  {fields.length > 0 ? (
                    <div className="border border-border rounded-lg overflow-hidden bg-card mt-4">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead className="w-24">Cantidad</TableHead>
                            <TableHead className="text-right">V. Normal</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fields.map((field, index) => {
                            const item = watchItems[index];
                            if (!item) return null;
                            const prod = productos?.find(p => p.codigo === item.productoCodigo);
                            return (
                              <TableRow key={field.id}>
                                <TableCell className="font-medium">{prod?.nombre || item.productoCodigo}</TableCell>
                                <TableCell>
                                  <Input 
                                    type="number" 
                                    min="1"
                                    {...form.register(`items.${index}.cantidad`)} 
                                    className="h-8 w-20 text-center" 
                                  />
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {formatCurrency((prod?.precioVenta || 0) * item.cantidad)}
                                </TableCell>
                                <TableCell>
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                                    onClick={() => remove(index)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center p-6 border-2 border-dashed border-border rounded-lg bg-card/50 flex flex-col items-center justify-center">
                      <PackagePlus className="w-8 h-8 text-muted-foreground mb-2 opacity-20" />
                      <p className="text-sm text-muted-foreground">No hay productos en este combo.</p>
                      <p className="text-xs text-muted-foreground/70">Seleccioná un producto arriba para agregarlo.</p>
                      {form.formState.errors.items && (
                        <p className="text-sm font-medium text-destructive mt-2">{form.formState.errors.items.message}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* PRICING */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-accent/5 p-4 rounded-xl border border-accent/20">
                  <div className="flex flex-col justify-center">
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1">
                      <Info className="w-4 h-4" />
                      Valor normal de los productos
                    </p>
                    <p className="text-2xl font-medium text-muted-foreground line-through decoration-destructive/40">
                      {formatCurrency(valorNormal)}
                    </p>
                    {valorNormal > precioVenta && precioVenta > 0 && (
                      <p className="text-sm font-medium text-emerald-600 mt-1 bg-emerald-50 dark:bg-emerald-900/30 w-fit px-2 py-0.5 rounded-md">
                        Ahorro cliente: {formatCurrency(valorNormal - precioVenta)}
                      </p>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="precioVenta"
                    render={({ field }) => (
                      <FormItem className="bg-card p-3 rounded-lg shadow-sm border border-border">
                        <FormLabel className="text-primary font-bold text-base">Precio Final del Combo</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-bold">$</span>
                            <Input 
                              type="number" 
                              step="0.01" 
                              {...field} 
                              className="text-2xl font-bold text-foreground pl-8 h-12" 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={crearMutation.isPending || fields.length === 0} className="px-8">
                    {crearMutation.isPending ? "Guardando..." : "Crear Combo"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* TOOLBAR */}
      <div className="flex items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar combos..." 
            className="pl-8 bg-card border-border/60 focus:border-primary/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* COMBOS GRID */}
      {isLoadingCombos ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-card h-64 rounded-xl border border-border animate-pulse flex flex-col p-6">
              <div className="w-2/3 h-6 bg-muted rounded mb-2" />
              <div className="w-full h-4 bg-muted/50 rounded mb-6" />
              <div className="w-1/3 h-8 bg-muted rounded mb-4" />
              <div className="flex-1 bg-muted/30 rounded-lg" />
            </div>
          ))}
        </div>
      ) : filteredCombos?.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border border-dashed">
          <Layers className="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-4" />
          <h3 className="text-lg font-medium text-foreground">No se encontraron combos</h3>
          <p className="text-muted-foreground text-sm mt-1">Crea tu primer combo para ofrecer promociones a tus clientes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCombos?.map((combo) => (
            <div key={combo.id} className="bg-card text-card-foreground rounded-xl border border-border shadow-sm flex flex-col overflow-hidden hover:shadow-md transition-shadow group relative">
              
              <div className="p-5 pb-3">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h3 className="font-bold text-lg leading-tight text-foreground group-hover:text-primary transition-colors">
                    {combo.nombre}
                  </h3>
                  <div className="flex items-center gap-1">
                    {combo.activo ? (
                      <Badge variant="secondary" className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border-transparent shadow-none">Activo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground shadow-none">Inactivo</Badge>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Borrar combo ${combo.nombre}`}
                      onClick={() => setComboToDelete({ id: combo.id, nombre: combo.nombre })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 h-10">
                  {combo.descripcion || <span className="italic opacity-50">Sin descripción</span>}
                </p>
              </div>

              <div className="p-5 pt-0 flex-1 flex flex-col">
                <div className="text-3xl font-black text-primary mb-4 tracking-tight">
                  {formatCurrency(combo.precioVenta)}
                </div>
                
                <div className="bg-sidebar rounded-lg p-3 flex-1 border border-border/50">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <PackagePlus className="w-3 h-3" /> Contenido
                  </h4>
                  <ul className="text-sm space-y-2">
                    {combo.items.map((item, i) => (
                      <li key={i} className="flex justify-between items-start">
                        <span className="flex items-start gap-2">
                          <Badge variant="outline" className="h-5 px-1.5 min-w-5 flex items-center justify-center font-mono text-[10px] bg-background">
                            {item.cantidad}
                          </Badge>
                          <span className="font-medium text-foreground/80 leading-tight pt-0.5">{item.productoNombre}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!comboToDelete} onOpenChange={open => { if (!open) setComboToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar combo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{comboToDelete?.nombre}</strong> junto con los productos incluidos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => comboToDelete && eliminarMutation.mutate({ id: comboToDelete.id })}
            >
              {eliminarMutation.isPending ? "Borrando..." : "Borrar combo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
