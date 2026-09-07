import { Router } from "express";
import {
  camionetasTable,
  comboItemsTable,
  combosTable,
  db,
  productosTable,
  proveedoresTable,
  stockCamionetaTable,
} from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import {
  CrearProductoBody,
  ObtenerProductoParams,
  ActualizarProductoParams,
  ActualizarProductoBody,
  EliminarProductoParams,
  EliminarProductoResponse,
} from "@workspace/api-zod";
import {
  requireAdmin,
  requireAdminOrDavidForPrices,
  requireAuth,
  type AuthenticatedSession,
} from "../middleware/auth";

const router = Router();
router.use(requireAuth);

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

router.post("/", requireAdmin, async (req, res) => {
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

router.put("/:codigo", requireAdminOrDavidForPrices, async (req, res) => {
  const paramParsed = ActualizarProductoParams.safeParse({ codigo: req.params.codigo });
  if (!paramParsed.success) return res.status(400).json({ error: "Código inválido" });
  const bodyParsed = ActualizarProductoBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: bodyParsed.error.message });

  const session = req.session as unknown as AuthenticatedSession;
  const puedeEditarProductoCompleto =
    session.rol === "admin" || session.adminActionAuthorized === true;
  if (session.adminActionAuthorized) {
    session.adminActionAuthorized = false;
  }
  const updateData: Record<string, unknown> = puedeEditarProductoCompleto
    ? { ...bodyParsed.data, actualizadoEn: new Date() }
    : { actualizadoEn: new Date() };

  if (
    !puedeEditarProductoCompleto
    && bodyParsed.data.precioVenta === undefined
    && bodyParsed.data.precioCosto === undefined
  ) {
    return res.status(400).json({ error: "David solo puede actualizar los precios del producto" });
  }

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

router.delete("/:codigo", requireAdmin, async (req, res): Promise<void> => {
  const parsed = EliminarProductoParams.safeParse({ codigo: req.params.codigo });
  if (!parsed.success) {
    res.status(400).json({ error: "Código inválido" });
    return;
  }

  const [producto] = await db
    .select({ codigo: productosTable.codigo, nombre: productosTable.nombre })
    .from(productosTable)
    .where(eq(productosTable.codigo, parsed.data.codigo));

  if (!producto) {
    res.status(404).json({ error: "Producto no encontrado" });
    return;
  }

  const [combos, stockCamionetas] = await Promise.all([
    db
      .select({ nombre: combosTable.nombre })
      .from(comboItemsTable)
      .innerJoin(combosTable, eq(comboItemsTable.comboId, combosTable.id))
      .where(eq(comboItemsTable.productoCodigo, producto.codigo)),
    db
      .select({ nombre: camionetasTable.nombre, cantidad: stockCamionetaTable.cantidad })
      .from(stockCamionetaTable)
      .innerJoin(camionetasTable, eq(stockCamionetaTable.camionetaId, camionetasTable.id))
      .where(and(
        eq(stockCamionetaTable.productoCodigo, producto.codigo),
        gt(stockCamionetaTable.cantidad, 0),
      )),
  ]);

  const usos: string[] = [];
  if (combos.length > 0) {
    usos.push(`está incluido en el combo ${combos.map(combo => `"${combo.nombre}"`).join(", ")}`);
  }
  if (stockCamionetas.length > 0) {
    usos.push(`tiene stock asignado en ${stockCamionetas.map(camioneta => `"${camioneta.nombre}" (${camioneta.cantidad})`).join(", ")}`);
  }

  if (usos.length > 0) {
    res.status(409).json({
      error: `No se puede eliminar "${producto.nombre}" porque ${usos.join(" y ")}. Quitá esas referencias antes de eliminarlo.`,
    });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(stockCamionetaTable)
      .where(eq(stockCamionetaTable.productoCodigo, producto.codigo));
    await tx
      .delete(productosTable)
      .where(eq(productosTable.codigo, producto.codigo));
  });
  res.json(EliminarProductoResponse.parse({ mensaje: "Producto eliminado" }));
});

export default router;
