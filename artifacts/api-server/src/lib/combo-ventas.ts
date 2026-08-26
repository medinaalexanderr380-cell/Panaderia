import { eq, inArray } from "drizzle-orm";
import { comboItemsTable, combosTable, db, productosTable } from "@workspace/db";

export type SeleccionSolicitada = { productoCodigo: string; cantidad: number };
export type ComboSolicitado = { comboId: number; selecciones: SeleccionSolicitada[] };

export type ComboPreparado = {
  comboId: number;
  codigoLinea: string;
  nombreLinea: string;
  precioVenta: number;
  costoTotal: number;
  selecciones: Array<{ productoCodigo: string; productoNombre: string; cantidad: number }>;
};

export async function prepararCombos(solicitudes: ComboSolicitado[]): Promise<ComboPreparado[]> {
  const preparados: ComboPreparado[] = [];

  for (const solicitud of solicitudes) {
    const [combo] = await db.select().from(combosTable).where(eq(combosTable.id, solicitud.comboId));
    if (!combo || !combo.activo) {
      throw new Error("El combo seleccionado no existe o está inactivo");
    }

    const opciones = await db
      .select({ productoCodigo: comboItemsTable.productoCodigo, cantidad: comboItemsTable.cantidad })
      .from(comboItemsTable)
      .where(eq(comboItemsTable.comboId, combo.id));

    const solicitadas = solicitud.selecciones ?? [];
    const codigos = solicitadas.map(item => item.productoCodigo);
    if (new Set(codigos).size !== codigos.length || solicitadas.some(item => !Number.isInteger(item.cantidad) || item.cantidad < 1)) {
      throw new Error(`La selección de gustos para "${combo.nombre}" no es válida`);
    }

    const seleccionesBase = combo.tipo === "a_eleccion"
      ? solicitadas
      : opciones.map(item => ({ productoCodigo: item.productoCodigo, cantidad: item.cantidad }));

    const permitidos = new Set(opciones.map(item => item.productoCodigo));
    if (seleccionesBase.length === 0 || seleccionesBase.some(item => !permitidos.has(item.productoCodigo))) {
      throw new Error(`La selección incluye un gusto que no pertenece a "${combo.nombre}"`);
    }

    const cantidadTotal = seleccionesBase.reduce((total, item) => total + item.cantidad, 0);
    if (combo.tipo === "a_eleccion" && cantidadTotal !== combo.cantidadEleccion) {
      throw new Error(`El combo "${combo.nombre}" requiere elegir exactamente ${combo.cantidadEleccion} unidades`);
    }

    const productos = await db
      .select({ codigo: productosTable.codigo, nombre: productosTable.nombre, precioCosto: productosTable.precioCosto })
      .from(productosTable)
      .where(inArray(productosTable.codigo, seleccionesBase.map(item => item.productoCodigo)));
    if (productos.length !== seleccionesBase.length) {
      throw new Error(`Uno o más gustos de "${combo.nombre}" ya no existen`);
    }

    const selecciones = seleccionesBase.map(item => {
      const producto = productos.find(row => row.codigo === item.productoCodigo)!;
      return { productoCodigo: producto.codigo, productoNombre: producto.nombre, cantidad: item.cantidad };
    });
    const resumen = selecciones.map(item => `${item.cantidad}× ${item.productoNombre}`).join(", ");
    const costoTotal = selecciones.reduce((total, item) => {
      const producto = productos.find(row => row.codigo === item.productoCodigo)!;
      return total + Number(producto.precioCosto) * item.cantidad;
    }, 0);

    preparados.push({
      comboId: combo.id,
      codigoLinea: `COMBO-${combo.id}`,
      nombreLinea: `${combo.nombre} — ${resumen}`,
      precioVenta: Number(combo.precioVenta),
      costoTotal,
      selecciones,
    });
  }

  return preparados;
}