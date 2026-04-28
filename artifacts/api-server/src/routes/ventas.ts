import { Router } from "express";
import { db } from "@workspace/db";
import { ventasTable, itemsVentaTable, productosTable } from "@workspace/db";
import { eq, gte, lte, and, sql, SQL } from "drizzle-orm";
import { RegistrarVentaBody, ListarVentasQueryParams, ObtenerVentaParams, EliminarVentaParams } from "@workspace/api-zod";

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

// List all sales (with optional filters)
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

// List all days that have sales
router.get("/dias", async (req, res) => {
  const dias = await db
    .select({
      fecha: sql<string>`DATE(${ventasTable.fecha})`,
      totalVentas: sql<number>`sum(${ventasTable.total}::numeric)`,
      totalGanancia: sql<number>`sum(${ventasTable.ganancia}::numeric)`,
      cantidadVentas: sql<number>`count(*)`,
    })
    .from(ventasTable)
    .groupBy(sql`DATE(${ventasTable.fecha})`)
    .orderBy(sql`DATE(${ventasTable.fecha}) DESC`);

  // For each day get the actual ventas
  const result = await Promise.all(
    dias.map(async (dia) => {
      const ventasDia = await db
        .select()
        .from(ventasTable)
        .where(sql`DATE(${ventasTable.fecha}) = ${dia.fecha}`)
        .orderBy(ventasTable.fecha);
      const ventasConItems = await Promise.all(ventasDia.map(ventaConItems));
      return {
        fecha: dia.fecha,
        totalVentas: Number(dia.totalVentas),
        totalGanancia: Number(dia.totalGanancia),
        cantidadVentas: Number(dia.cantidadVentas),
        ventas: ventasConItems,
      };
    })
  );
  return res.json(result);
});

// Get + delete by specific day
router.get("/dia/:fecha", async (req, res) => {
  const { fecha } = req.params;
  const ventasDia = await db
    .select()
    .from(ventasTable)
    .where(sql`DATE(${ventasTable.fecha}) = ${fecha}`)
    .orderBy(ventasTable.fecha);

  const ventas = await Promise.all(ventasDia.map(ventaConItems));
  const totalVentas = ventas.reduce((s, v) => s + v.total, 0);
  const totalGanancia = ventas.reduce((s, v) => s + v.ganancia, 0);

  return res.json({
    fecha,
    totalVentas,
    totalGanancia,
    cantidadVentas: ventas.length,
    ventas,
  });
});

router.delete("/dia/:fecha", async (req, res) => {
  const { fecha } = req.params;

  const ventasDia = await db
    .select()
    .from(ventasTable)
    .where(sql`DATE(${ventasTable.fecha}) = ${fecha}`);

  for (const venta of ventasDia) {
    // Restore stock for each item
    const items = await db.select().from(itemsVentaTable).where(eq(itemsVentaTable.ventaId, venta.id));
    for (const item of items) {
      const [producto] = await db.select().from(productosTable).where(eq(productosTable.codigo, item.productoCodigo));
      if (producto) {
        await db.update(productosTable)
          .set({ stock: producto.stock + item.cantidad, actualizadoEn: new Date() })
          .where(eq(productosTable.codigo, item.productoCodigo));
      }
    }
    await db.delete(itemsVentaTable).where(eq(itemsVentaTable.ventaId, venta.id));
    await db.delete(ventasTable).where(eq(ventasTable.id, venta.id));
  }

  return res.json({ mensaje: `${ventasDia.length} venta(s) del día ${fecha} eliminada(s)` });
});

// Export day's sales as CSV
router.get("/dia/:fecha/exportar", async (req, res) => {
  const { fecha } = req.params;

  const ventasDia = await db
    .select()
    .from(ventasTable)
    .where(sql`DATE(${ventasTable.fecha}) = ${fecha}`)
    .orderBy(ventasTable.fecha);

  const ventas = await Promise.all(ventasDia.map(ventaConItems));
  const totalVentas = ventas.reduce((s, v) => s + v.total, 0);
  const totalGanancia = ventas.reduce((s, v) => s + v.ganancia, 0);

  const lines: string[] = [];
  lines.push(`"Reporte de Ventas - ${fecha}"`);
  lines.push(`"Total del día","${totalVentas.toFixed(2)}"`);
  lines.push(`"Ganancia del día","${totalGanancia.toFixed(2)}"`);
  lines.push(`"Cantidad de ventas","${ventas.length}"`);
  lines.push("");
  lines.push('"#Venta","Hora","Vendedor","Producto","Código","Cantidad","Precio Unitario","Subtotal"');

  for (const venta of ventas) {
    const hora = new Date(venta.fecha).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    for (const item of venta.items) {
      lines.push(
        `"#${String(venta.id).padStart(4, "0")}","${hora}","${venta.vendedor}","${item.productoNombre}","${item.productoCodigo}","${item.cantidad}","${item.precioUnitario.toFixed(2)}","${item.subtotal.toFixed(2)}"`
      );
    }
  }

  lines.push("");
  lines.push(`"TOTAL VENTAS","","","","","","","${totalVentas.toFixed(2)}"`);
  lines.push(`"GANANCIA TOTAL","","","","","","","${totalGanancia.toFixed(2)}"`);

  const csv = lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="ventas-${fecha}.csv"`);
  return res.send("\uFEFF" + csv); // BOM for Excel compatibility
});

// Register a sale
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

// Get single sale
router.get("/:id", async (req, res) => {
  const parsed = ObtenerVentaParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "ID inválido" });
  const [venta] = await db.select().from(ventasTable).where(eq(ventasTable.id, parsed.data.id));
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });
  return res.json(await ventaConItems(venta));
});

// Delete single sale
router.delete("/:id", async (req, res) => {
  const parsed = EliminarVentaParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "ID inválido" });
  const id = parsed.data.id;

  const [venta] = await db.select().from(ventasTable).where(eq(ventasTable.id, id));
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });

  // Restore stock
  const items = await db.select().from(itemsVentaTable).where(eq(itemsVentaTable.ventaId, id));
  for (const item of items) {
    const [producto] = await db.select().from(productosTable).where(eq(productosTable.codigo, item.productoCodigo));
    if (producto) {
      await db.update(productosTable)
        .set({ stock: producto.stock + item.cantidad, actualizadoEn: new Date() })
        .where(eq(productosTable.codigo, item.productoCodigo));
    }
  }

  await db.delete(itemsVentaTable).where(eq(itemsVentaTable.ventaId, id));
  await db.delete(ventasTable).where(eq(ventasTable.id, id));

  return res.json({ mensaje: "Venta eliminada" });
});

export default router;
