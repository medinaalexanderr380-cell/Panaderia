import { useMemo, useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Combo = {
  id: number;
  nombre: string;
  descripcion: string;
  precioVenta: number;
  tipo: "fijo" | "a_eleccion";
  cantidadEleccion: number;
  items: Array<{ productoCodigo: string; productoNombre: string; cantidad: number }>;
};

export type SeleccionCombo = { productoCodigo: string; productoNombre: string; cantidad: number };
export type ComboParaCarrito = { comboId: number; nombre: string; precioVenta: number; selecciones: SeleccionCombo[] };

export function SelectorCombo({
  combos,
  stockDisponible,
  onAgregar,
}: {
  combos: Combo[];
  stockDisponible: Record<string, number>;
  onAgregar: (combo: ComboParaCarrito) => void;
}) {
  const [open, setOpen] = useState(false);
  const [combo, setCombo] = useState<Combo | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  const selecciones = useMemo(() => (combo?.items ?? [])
    .map(item => ({ ...item, cantidad: combo?.tipo === "fijo" ? item.cantidad : (cantidades[item.productoCodigo] ?? 0) }))
    .filter(item => item.cantidad > 0), [combo, cantidades]);
  const totalElegido = selecciones.reduce((total, item) => total + item.cantidad, 0);
  const sinStock = selecciones.some(item => item.cantidad > (stockDisponible[item.productoCodigo] ?? 0));
  const puedeAgregar = !!combo && !sinStock && (combo.tipo === "fijo" || totalElegido === combo.cantidadEleccion);

  const elegirCombo = (nuevo: Combo) => {
    setCombo(nuevo);
    setCantidades({});
  };
  const cerrar = (valor: boolean) => {
    setOpen(valor);
    if (!valor) {
      setCombo(null);
      setCantidades({});
    }
  };
  const agregar = () => {
    if (!combo || !puedeAgregar) return;
    onAgregar({
      comboId: combo.id,
      nombre: combo.nombre,
      precioVenta: combo.precioVenta,
      selecciones: selecciones.map(({ productoCodigo, productoNombre, cantidad }) => ({ productoCodigo, productoNombre, cantidad })),
    });
    cerrar(false);
  };

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline"><ShoppingBag className="mr-2 h-4 w-4" />Agregar combo</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar un combo</DialogTitle>
          <DialogDescription>Los gustos se descuentan del stock disponible al confirmar la venta.</DialogDescription>
        </DialogHeader>
        {!combo ? (
          <div className="grid gap-3">
            {combos.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No hay combos activos.</p> : combos.map(item => (
              <button key={item.id} type="button" onClick={() => elegirCombo(item)} className="rounded-lg border p-4 text-left hover:border-primary hover:bg-primary/5">
                <div className="flex items-center justify-between gap-3">
                  <strong>{item.nombre}</strong><Badge>{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(item.precioVenta)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.descripcion || (item.tipo === "a_eleccion" ? `Elegí ${item.cantidadEleccion} unidades entre los gustos disponibles.` : "Combo de contenido fijo.")}</p>
                {item.tipo === "a_eleccion" && <Badge variant="secondary" className="mt-2">A elección: {item.cantidadEleccion} unidades</Badge>}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between gap-3"><div><h3 className="font-semibold">{combo.nombre}</h3><p className="text-sm text-muted-foreground">{combo.tipo === "a_eleccion" ? `Elegí ${combo.cantidadEleccion} unidades` : "Contenido fijo"}</p></div><Button variant="ghost" onClick={() => setCombo(null)}>Cambiar</Button></div>
            <div className="space-y-2">
              {combo.items.map(item => {
                const cantidad = combo.tipo === "fijo" ? item.cantidad : (cantidades[item.productoCodigo] ?? 0);
                const disponible = stockDisponible[item.productoCodigo] ?? 0;
                return <div key={item.productoCodigo} className="flex items-center gap-3 rounded-md border p-3">
                  <div className="flex-1"><p className="font-medium">{item.productoNombre}</p><p className={`text-xs ${disponible < cantidad ? "text-destructive" : "text-muted-foreground"}`}>Disponibles: {disponible}</p></div>
                  {combo.tipo === "a_eleccion" ? <div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setCantidades(actual => ({ ...actual, [item.productoCodigo]: Math.max(0, (actual[item.productoCodigo] ?? 0) - 1) }))}><Minus className="h-3 w-3" /></Button><span className="w-6 text-center font-bold">{cantidad}</span><Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={cantidad >= disponible || totalElegido >= combo.cantidadEleccion} onClick={() => setCantidades(actual => ({ ...actual, [item.productoCodigo]: (actual[item.productoCodigo] ?? 0) + 1 }))}><Plus className="h-3 w-3" /></Button></div> : <Badge>{cantidad} u.</Badge>}
                </div>;
              })}
            </div>
            {combo.tipo === "a_eleccion" && <p className={`text-sm font-medium ${totalElegido === combo.cantidadEleccion ? "text-primary" : "text-muted-foreground"}`}>Elegidas: {totalElegido} / {combo.cantidadEleccion}</p>}
            {sinStock && <p className="text-sm text-destructive">La selección supera el stock disponible.</p>}
            <Button className="w-full" disabled={!puedeAgregar} onClick={agregar}><Check className="mr-2 h-4 w-4" />Agregar al carrito</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}