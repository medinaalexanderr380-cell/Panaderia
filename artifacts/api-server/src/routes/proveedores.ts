import { Router } from "express";
import { db } from "@workspace/db";
import { proveedoresTable, productosTable, comprasTable, itemsCompraTable } from "@workspace/db";
import { eq, sql, max, count, sum } from "drizzle-orm";
import {
  CrearProveedorBody,
  ObtenerProveedorParams,
  ActualizarProveedorParams,
  ActualizarProveedorBody,
  EliminarProveedorParams,
  ObtenerProductosPorProveedorParams,
  ObtenerComprasPorProveedorParams,
  ObtenerResumenProveedorParams,
} from "@workspace/api-zod";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const proveedores = await db.select().from(proveedoresTable).orderBy(proveedoresTable.nombre);
  return res.json(proveedores.map(p => ({
    ...p,
    creadoEn: p.creadoEn.toISOString(),
    actualizadoEn: p.actualizadoEn.toISOString(),
  })));
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = CrearProveedorBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const [proveedor] = await db.insert(proveedoresTable).values(parsed.data).returning();
  return res.status(201).json({
    ...proveedor,
    creadoEn: proveedor.creadoEn.toISOString(),
    actualizadoEn: proveedor.actualizadoEn.toISOString(),
  });
});

router.get("/:id", async (req, res) => {
  const parsed = ObtenerProveedorParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "ID inválido" });
  const [proveedor] = await db.select().from(proveedoresTable).where(eq(proveedoresTable.id, parsed.data.id));
  if (!proveedor) return res.status(404).json({ error: "Proveedor no encontrado" });
  return res.json({
    ...proveedor,
    creadoEn: proveedor.creadoEn.toISOString(),
    actualizadoEn: proveedor.actualizadoEn.toISOString(),
  });
});

router.put("/:id", requireAdmin, async (req, res) => {
  const paramParsed = ActualizarProveedorParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) return res.status(400).json({ error: "ID inválido" });
  const bodyParsed = ActualizarProveedorBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: bodyParsed.error.message });
  const [proveedor] = await db
    .update(proveedoresTable)
    .set({ ...bodyParsed.data, actualizadoEn: new Date() })
    .where(eq(proveedoresTable.id, paramParsed.data.id))
    .returning();
  if (!proveedor) return res.status(404).json({ error: "Proveedor no encontrado" });
  return res.json({
    ...proveedor,
    creadoEn: proveedor.creadoEn.toISOString(),
    actualizadoEn: proveedor.actualizadoEn.toISOString(),
  });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const parsed = EliminarProveedorParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "ID inválido" });
  await db.delete(proveedoresTable).where(eq(proveedoresTable.id, parsed.data.id));
  return res.json({ mensaje: "Proveedor eliminado" });
});

router.get("/:id/productos", async (req, res) => {
  const parsed = ObtenerProductosPorProveedorParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "ID inválido" });
  const productos = await db
    .select({
      id: productosTable.id,
      codigo: productosTable.codigo,
      nombre: productosTable.nombre,
      descripcion: productosTable.descripcion,
      precioVenta: productosTable.precioVenta,
      precioCosto: productosTable.precioCosto,
      stock: productosTable.stock,
      stockMinimo: productosTable.stockMinimo,
      unidad: productosTable.unidad,
      proveedorId: productosTable.proveedorId,
      proveedorNombre: proveedoresTable.nombre,
      creadoEn: productosTable.creadoEn,
      actualizadoEn: productosTable.actualizadoEn,
    })
    .from(productosTable)
    .leftJoin(proveedoresTable, eq(productosTable.proveedorId, proveedoresTable.id))
    .where(eq(productosTable.proveedorId, parsed.data.id));
  return res.json(productos.map(p => ({
    ...p,
    precioVenta: Number(p.precioVenta),
    precioCosto: Number(p.precioCosto),
    creadoEn: p.creadoEn.toISOString(),
    actualizadoEn: p.actualizadoEn.toISOString(),
  })));
});

router.get("/:id/compras", async (req, res) => {
  const parsed = ObtenerComprasPorProveedorParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "ID inválido" });
  const compras = await db.select().from(comprasTable).where(eq(comprasTable.proveedorId, parsed.data.id));
  const result = await Promise.all(
    compras.map(async (c) => {
      const items = await db.select().from(itemsCompraTable).where(eq(itemsCompraTable.compraId, c.id));
      return {
        ...c,
        totalInvertido: Number(c.totalInvertido),
        fecha: c.fecha.toISOString(),
        items: items.map(i => ({ ...i, precioCosto: Number(i.precioCosto), subtotal: Number(i.subtotal) })),
      };
    })
  );
  return res.json(result);
});

router.get("/:id/resumen", async (req, res) => {
  const parsed = ObtenerResumenProveedorParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "ID inválido" });
  const provId = parsed.data.id;

  const [proveedor] = await db.select().from(proveedoresTable).where(eq(proveedoresTable.id, provId));
  if (!proveedor) return res.status(404).json({ error: "Proveedor no encontrado" });

  const comprasResult = await db
    .select({
      totalCompras: count(comprasTable.id),
      totalInvertido: sql<number>`coalesce(sum(${comprasTable.totalInvertido}::numeric), 0)`,
      ultimaCompra: max(comprasTable.fecha),
    })
    .from(comprasTable)
    .where(eq(comprasTable.proveedorId, provId));

  const productosResult = await db
    .select({ total: count(productosTable.id) })
    .from(productosTable)
    .where(eq(productosTable.proveedorId, provId));

  return res.json({
    proveedorId: provId,
    proveedorNombre: proveedor.nombre,
    totalCompras: Number(comprasResult[0]?.totalCompras ?? 0),
    totalInvertido: Number(comprasResult[0]?.totalInvertido ?? 0),
    totalProductos: Number(productosResult[0]?.total ?? 0),
    ultimaCompra: comprasResult[0]?.ultimaCompra ? (comprasResult[0].ultimaCompra as Date).toISOString() : null,
  });
});

export default router;
