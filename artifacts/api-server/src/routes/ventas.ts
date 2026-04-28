import { Router } from "express";
import { db } from "@workspace/db";
import { ventasTable, itemsVentaTable, productosTable } from "@workspace/db";
import { eq, gte, lte, and, SQL } from "drizzle-orm";
import { RegistrarVentaBody, ListarVentasQueryParams, ObtenerVentaParams } from "@workspace/api-zod";

const router = Router();

async function ventaConItems(venta: typeof ventasTable.$inferSelect) {
  const items = await db.select().from(itemsVentaTable).where(eq(itemsVentaTable.ventaId, venta.id));
  return {
    ...venta,
    total: Number(venta.total),
    ganancia: Number(venta.ganancia),
    fecha: venta.fecha.toISOString(),
    items: items.map(i => ({
      ...i,
      precioUnitario: Number(i.precioUnitario),
      precioCosto: Number(i.precioCosto),
      subtotal: Number(i.subtotal),
    })),
  };
}

router.get("/", async (req, res) => {
  const parsed = ListarVentasQueryParams.safeParse(req.query);
  const conditions: SQL[] = [];

  if (parsed.success) {
    if (parsed.data.fechaDesde) conditions.push(gte(ventasTable.fecha, new Date(parsed.data.fechaDesde)));
    if (parsed.data.fechaHasta) conditions.push(lte(ventasTable.fecha, new Date(parsed.data.fechaHasta)));
    if (parsed.data.vendedor) conditions.push(eq(ventasTable.vendedor, parsed.data.vendedor));
  }

  const ventas = conditions.length > 0
    ? await db.select().from(ventasTable).where(and(...conditions)).orderBy(ventasTable.fecha)
    : await db.select().from(ventasTable).orderBy(ventasTable.fecha);

  const result = await Promise.all(ventas.map(ventaConItems));
  return res.json(result);
});

router.post("/", async (req, res) => {
  const parsed = RegistrarVentaBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const { vendedor, items } = parsed.data;
  let total = 0;
  let ganancia = 0;

  const itemsData: Array<{
    productoCodigo: string;
    productoNombre: string;
    cantidad: number;
    precioUnitario: string;
    precioCosto: string;
    subtotal: string;
  }> = [];

  for (const item of items) {
    const [producto] = await db.select().from(productosTable).where(eq(productosTable.codigo, item.productoCodigo));
    if (!producto) return res.status(404).json({ error: `Producto ${item.productoCodigo} no encontrado` });
    if (producto.stock < item.cantidad) {
      return res.status(400).json({ error: `Stock insuficiente para ${producto.nombre}. Stock disponible: ${producto.stock}` });
    }

    const precioVenta = Number(producto.precioVenta);
    const precioCosto = Number(producto.precioCosto);
    const subtotal = precioVenta * item.cantidad;
    const costoTotal = precioCosto * item.cantidad;
    total += subtotal;
    ganancia += subtotal - costoTotal;

    itemsData.push({
      productoCodigo: item.productoCodigo,
      productoNombre: producto.nombre,
      cantidad: item.cantidad,
      precioUnitario: String(precioVenta),
      precioCosto: String(precioCosto),
      subtotal: String(subtotal),
    });

    await db.update(productosTable)
      .set({ stock: producto.stock - item.cantidad, actualizadoEn: new Date() })
      .where(eq(productosTable.codigo, item.productoCodigo));
  }

  const [venta] = await db.insert(ventasTable).values({
    vendedor,
    total: String(total),
    ganancia: String(ganancia),
  }).returning();

  for (const item of itemsData) {
    await db.insert(itemsVentaTable).values({ ventaId: venta.id, ...item });
  }

  return res.status(201).json(await ventaConItems(venta));
});

router.get("/:id", async (req, res) => {
  const parsed = ObtenerVentaParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "ID inválido" });
  const [venta] = await db.select().from(ventasTable).where(eq(ventasTable.id, parsed.data.id));
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });
  return res.json(await ventaConItems(venta));
});

export default router;
