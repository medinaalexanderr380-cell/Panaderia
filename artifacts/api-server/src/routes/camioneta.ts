import { Router } from "express";
import { db } from "@workspace/db";
import { productosTable, perdidasTable, ventasTable, itemsVentaTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/stock", async (req, res) => {
  const productos = await db
    .select({
      codigo: productosTable.codigo,
      nombre: productosTable.nombre,
      descripcion: productosTable.descripcion,
      stockCamioneta: productosTable.stockCamioneta,
      precioVenta: productosTable.precioVenta,
      precioCosto: productosTable.precioCosto,
      unidad: productosTable.unidad,
    })
    .from(productosTable)
    .where(sql`${productosTable.stockCamioneta} > 0`)
    .orderBy(productosTable.nombre);

  return res.json(productos.map(p => ({
    ...p,
    precioVenta: Number(p.precioVenta),
    precioCosto: Number(p.precioCosto),
  })));
});

router.post("/cargar", async (req, res) => {
  const { items } = req.body as { items: { productoCodigo: string; cantidad: number }[] };
  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "Se requieren items para cargar" });

  const resultados = [];
  for (const item of items) {
    if (!item.productoCodigo || !item.cantidad || item.cantidad <= 0)
      return res.status(400).json({ error: `Item inválido: ${JSON.stringify(item)}` });

    const [producto] = await db.select().from(productosTable).where(eq(productosTable.codigo, item.productoCodigo));
    if (!producto) return res.status(404).json({ error: `Producto no encontrado: ${item.productoCodigo}` });
    if (producto.stock < item.cantidad)
      return res.status(400).json({ error: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}` });

    const [updated] = await db
      .update(productosTable)
      .set({
        stock: sql`${productosTable.stock} - ${item.cantidad}`,
        stockCamioneta: sql`${productosTable.stockCamioneta} + ${item.cantidad}`,
        actualizadoEn: new Date(),
      })
      .where(eq(productosTable.codigo, item.productoCodigo))
      .returning();

    resultados.push({ codigo: updated.codigo, nombre: updated.nombre, stockCamioneta: updated.stockCamioneta, stock: updated.stock });
  }

  return res.json({ mensaje: "Carga realizada exitosamente", resultados });
});

router.post("/descargar", async (req, res) => {
  const { items } = req.body as { items: { productoCodigo: string; cantidad: number }[] };
  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "Se requieren items para descargar" });

  const resultados = [];
  for (const item of items) {
    const [producto] = await db.select().from(productosTable).where(eq(productosTable.codigo, item.productoCodigo));
    if (!producto) return res.status(404).json({ error: `Producto no encontrado: ${item.productoCodigo}` });
    if (producto.stockCamioneta < item.cantidad)
      return res.status(400).json({ error: `Stock en camioneta insuficiente para ${producto.nombre}` });

    const [updated] = await db
      .update(productosTable)
      .set({
        stock: sql`${productosTable.stock} + ${item.cantidad}`,
        stockCamioneta: sql`${productosTable.stockCamioneta} - ${item.cantidad}`,
        actualizadoEn: new Date(),
      })
      .where(eq(productosTable.codigo, item.productoCodigo))
      .returning();

    resultados.push({ codigo: updated.codigo, nombre: updated.nombre, stockCamioneta: updated.stockCamioneta, stock: updated.stock });
  }

  return res.json({ mensaje: "Descarga realizada", resultados });
});

router.post("/ventas", async (req, res) => {
  const s = req.session as any;
  const { vendedor, items } = req.body as { vendedor: string; items: { productoCodigo: string; cantidad: number }[] };
  if (!vendedor || !items || items.length === 0)
    return res.status(400).json({ error: "Vendedor e items requeridos" });

  let totalVenta = 0;
  let totalGanancia = 0;
  const itemsDetalle: Array<{ codigo: string; nombre: string; cantidad: number; precioUnitario: number; precioCosto: number; subtotal: number }> = [];

  for (const item of items) {
    const [producto] = await db.select().from(productosTable).where(eq(productosTable.codigo, item.productoCodigo));
    if (!producto) return res.status(404).json({ error: `Producto no encontrado: ${item.productoCodigo}` });
    if (producto.stockCamioneta < item.cantidad)
      return res.status(400).json({ error: `Stock insuficiente en camioneta para ${producto.nombre}. Disponible: ${producto.stockCamioneta}` });

    const precioVenta = Number(producto.precioVenta);
    const precioCosto = Number(producto.precioCosto);
    const subtotal = precioVenta * item.cantidad;
    const ganancia = (precioVenta - precioCosto) * item.cantidad;
    totalVenta += subtotal;
    totalGanancia += ganancia;
    itemsDetalle.push({ codigo: producto.codigo, nombre: producto.nombre, cantidad: item.cantidad, precioUnitario: precioVenta, precioCosto, subtotal });
  }

  const [venta] = await db.insert(ventasTable).values({
    vendedor,
    total: String(totalVenta),
    ganancia: String(totalGanancia),
    origen: "camioneta",
  }).returning();

  for (const item of itemsDetalle) {
    await db.insert(itemsVentaTable).values({
      ventaId: venta.id,
      productoCodigo: item.codigo,
      productoNombre: item.nombre,
      cantidad: item.cantidad,
      precioUnitario: String(item.precioUnitario),
      precioCosto: String(item.precioCosto),
      subtotal: String(item.subtotal),
    });
    await db.update(productosTable).set({
      stockCamioneta: sql`${productosTable.stockCamioneta} - ${item.cantidad}`,
      actualizadoEn: new Date(),
    }).where(eq(productosTable.codigo, item.codigo));
  }

  return res.status(201).json({ id: venta.id, total: totalVenta, ganancia: totalGanancia, origen: "camioneta" });
});

router.post("/caducado", async (req, res) => {
  const s = req.session as any;
  const { productoCodigo, cantidad, origen } = req.body as { productoCodigo: string; cantidad: number; origen: "panaderia" | "camioneta" };
  if (!productoCodigo || !cantidad || cantidad <= 0)
    return res.status(400).json({ error: "Datos inválidos" });

  const [producto] = await db.select().from(productosTable).where(eq(productosTable.codigo, productoCodigo));
  if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

  const stockDisponible = origen === "camioneta" ? producto.stockCamioneta : producto.stock;
  if (stockDisponible < cantidad)
    return res.status(400).json({ error: `Stock insuficiente. Disponible: ${stockDisponible}` });

  const costoTotal = Number(producto.precioCosto) * cantidad;

  await db.insert(perdidasTable).values({
    productoCodigo: producto.codigo,
    productoNombre: producto.nombre,
    cantidad,
    costoTotal: String(costoTotal),
    motivo: "caducado",
    origen: origen || "panaderia",
    registradoPor: s?.nombre || "Sistema",
  });

  const updateField = origen === "camioneta"
    ? { stockCamioneta: sql`${productosTable.stockCamioneta} - ${cantidad}`, actualizadoEn: new Date() }
    : { stock: sql`${productosTable.stock} - ${cantidad}`, actualizadoEn: new Date() };

  await db.update(productosTable).set(updateField).where(eq(productosTable.codigo, productoCodigo));

  return res.json({ mensaje: "Pérdida registrada", costoTotal });
});

export default router;
