import { Router } from "express";
import { db } from "@workspace/db";
import { comprasTable, itemsCompraTable, productosTable, proveedoresTable } from "@workspace/db";
import { eq, gte, lte, and, SQL } from "drizzle-orm";
import { RegistrarCompraBody, ListarComprasQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

async function compraConItems(compra: typeof comprasTable.$inferSelect) {
  const items = await db.select().from(itemsCompraTable).where(eq(itemsCompraTable.compraId, compra.id));
  return {
    ...compra,
    totalInvertido: Number(compra.totalInvertido),
    fecha: compra.fecha.toISOString(),
    items: items.map(i => ({
      ...i,
      precioCosto: Number(i.precioCosto),
      subtotal: Number(i.subtotal),
    })),
  };
}

router.get("/", async (req, res) => {
  const parsed = ListarComprasQueryParams.safeParse(req.query);
  const conditions: SQL[] = [];

  if (parsed.success) {
    if (parsed.data.fechaDesde) conditions.push(gte(comprasTable.fecha, new Date(parsed.data.fechaDesde)));
    if (parsed.data.fechaHasta) conditions.push(lte(comprasTable.fecha, new Date(parsed.data.fechaHasta)));
  }

  const compras = conditions.length > 0
    ? await db.select().from(comprasTable).where(and(...conditions)).orderBy(comprasTable.fecha)
    : await db.select().from(comprasTable).orderBy(comprasTable.fecha);

  const result = await Promise.all(compras.map(compraConItems));
  return res.json(result);
});

router.post("/", async (req, res) => {
  const parsed = RegistrarCompraBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const { proveedor, notas, items } = parsed.data;

  let totalInvertido = 0;
  const itemsData: Array<{
    productoCodigo: string;
    productoNombre: string;
    cantidad: number;
    precioCosto: string;
    subtotal: string;
  }> = [];

  for (const item of items) {
    const [producto] = await db.select().from(productosTable).where(eq(productosTable.codigo, item.productoCodigo));
    if (!producto) return res.status(404).json({ error: `Producto ${item.productoCodigo} no encontrado` });

    const subtotal = item.precioCosto * item.cantidad;
    totalInvertido += subtotal;

    itemsData.push({
      productoCodigo: item.productoCodigo,
      productoNombre: producto.nombre,
      cantidad: item.cantidad,
      precioCosto: String(item.precioCosto),
      subtotal: String(subtotal),
    });

    await db.update(productosTable)
      .set({
        stock: producto.stock + item.cantidad,
        precioCosto: String(item.precioCosto),
        actualizadoEn: new Date(),
      })
      .where(eq(productosTable.codigo, item.productoCodigo));
  }

  let proveedorId: number | null = null;
  if (proveedor) {
    const [existingProv] = await db.select().from(proveedoresTable).where(eq(proveedoresTable.nombre, proveedor));
    if (existingProv) {
      proveedorId = existingProv.id;
    }
  }

  const [compra] = await db.insert(comprasTable).values({
    proveedor: proveedor ?? "Sin proveedor",
    proveedorId,
    notas: notas ?? null,
    totalInvertido: String(totalInvertido),
  }).returning();

  for (const item of itemsData) {
    await db.insert(itemsCompraTable).values({ compraId: compra.id, ...item });
  }

  return res.status(201).json(await compraConItems(compra));
});

export default router;
