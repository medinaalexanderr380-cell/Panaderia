import { Router } from "express";
import { db } from "@workspace/db";
import { productosTable, proveedoresTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CrearProductoBody,
  ObtenerProductoParams,
  ActualizarProductoParams,
  ActualizarProductoBody,
  EliminarProductoParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
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
    .orderBy(productosTable.codigo);

  return res.json(productos.map(p => ({
    ...p,
    precioVenta: Number(p.precioVenta),
    precioCosto: Number(p.precioCosto),
    creadoEn: p.creadoEn.toISOString(),
    actualizadoEn: p.actualizadoEn.toISOString(),
  })));
});

router.post("/", async (req, res) => {
  const parsed = CrearProductoBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const [existing] = await db.select().from(productosTable).where(eq(productosTable.codigo, parsed.data.codigo));
  if (existing) return res.status(409).json({ error: "Ya existe un producto con ese código" });

  const [producto] = await db.insert(productosTable).values({
    ...parsed.data,
    precioVenta: String(parsed.data.precioVenta),
    precioCosto: String(parsed.data.precioCosto),
  }).returning();

  let proveedorNombre: string | null = null;
  if (producto.proveedorId) {
    const [prov] = await db.select().from(proveedoresTable).where(eq(proveedoresTable.id, producto.proveedorId));
    proveedorNombre = prov?.nombre ?? null;
  }

  return res.status(201).json({
    ...producto,
    precioVenta: Number(producto.precioVenta),
    precioCosto: Number(producto.precioCosto),
    proveedorNombre,
    creadoEn: producto.creadoEn.toISOString(),
    actualizadoEn: producto.actualizadoEn.toISOString(),
  });
});

router.get("/:codigo", async (req, res) => {
  const parsed = ObtenerProductoParams.safeParse({ codigo: req.params.codigo });
  if (!parsed.success) return res.status(400).json({ error: "Código inválido" });

  const [row] = await db
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
    .where(eq(productosTable.codigo, parsed.data.codigo));

  if (!row) return res.status(404).json({ error: "Producto no encontrado" });
  return res.json({
    ...row,
    precioVenta: Number(row.precioVenta),
    precioCosto: Number(row.precioCosto),
    creadoEn: row.creadoEn.toISOString(),
    actualizadoEn: row.actualizadoEn.toISOString(),
  });
});

router.put("/:codigo", async (req, res) => {
  const paramParsed = ActualizarProductoParams.safeParse({ codigo: req.params.codigo });
  if (!paramParsed.success) return res.status(400).json({ error: "Código inválido" });
  const bodyParsed = ActualizarProductoBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: bodyParsed.error.message });

  const updateData: Record<string, unknown> = { ...bodyParsed.data, actualizadoEn: new Date() };
  if (bodyParsed.data.precioVenta !== undefined) updateData.precioVenta = String(bodyParsed.data.precioVenta);
  if (bodyParsed.data.precioCosto !== undefined) updateData.precioCosto = String(bodyParsed.data.precioCosto);

  const [producto] = await db
    .update(productosTable)
    .set(updateData)
    .where(eq(productosTable.codigo, paramParsed.data.codigo))
    .returning();

  if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

  let proveedorNombre: string | null = null;
  if (producto.proveedorId) {
    const [prov] = await db.select().from(proveedoresTable).where(eq(proveedoresTable.id, producto.proveedorId));
    proveedorNombre = prov?.nombre ?? null;
  }

  return res.json({
    ...producto,
    precioVenta: Number(producto.precioVenta),
    precioCosto: Number(producto.precioCosto),
    proveedorNombre,
    creadoEn: producto.creadoEn.toISOString(),
    actualizadoEn: producto.actualizadoEn.toISOString(),
  });
});

router.delete("/:codigo", async (req, res) => {
  const parsed = EliminarProductoParams.safeParse({ codigo: req.params.codigo });
  if (!parsed.success) return res.status(400).json({ error: "Código inválido" });
  await db.delete(productosTable).where(eq(productosTable.codigo, parsed.data.codigo));
  return res.json({ mensaje: "Producto eliminado" });
});

export default router;
