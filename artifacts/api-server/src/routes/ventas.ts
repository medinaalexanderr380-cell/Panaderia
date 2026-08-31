import { Router } from "express";
import { db } from "@workspace/db";
import { camionetasTable, itemsVentaTable, productosTable, stockCamionetaTable, ventasTable } from "@workspace/db";
import { eq, gte, inArray, lte, and, sql, SQL } from "drizzle-orm";
import { RegistrarVentaBody, ListarVentasQueryParams, ObtenerVentaParams, EliminarVentaParams } from "@workspace/api-zod";
import { prepararCombos } from "../lib/combo-ventas";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

async function ventaConItems(venta: typeof ventasTable.$inferSelect) {
  const items = await db.select().from(itemsVentaTable).where(eq(itemsVentaTable.ventaId, venta.id));
  return {
    ...venta,
    total: Number(venta.total),
    ganancia: Number(venta.ganancia),
    fecha: venta.fecha.toISOString(),
    items: items.map(i => ({
      ...i,
      comboId: i.comboId ?? null,
      selecciones: i.selecciones ?? [],
      precioUnitario: Number(i.precioUnitario),
      precioCosto: Number(i.precioCosto),
      subtotal: Number(i.subtotal),
    })),
  };
}

function consumosDeItems(items: Array<typeof itemsVentaTable.$inferSelect>) {
  const consumos = new Map<string, number>();
  for (const item of items) {
    const selecciones = item.tipo === "combo" && Array.isArray(item.selecciones)
      ? item.selecciones
      : [{ productoCodigo: item.productoCodigo, cantidad: item.cantidad }];
    for (const seleccion of selecciones) {
      if (typeof seleccion?.productoCodigo !== "string" || !Number.isInteger(seleccion?.cantidad) || seleccion.cantidad < 1) continue;
      consumos.set(seleccion.productoCodigo, (consumos.get(seleccion.productoCodigo) ?? 0) + seleccion.cantidad);
    }
  }
  return consumos;
}

async function restaurarStockVenta(tx: any, venta: typeof ventasTable.$inferSelect, items: Array<typeof itemsVentaTable.$inferSelect>) {
  const consumos = consumosDeItems(items);
  if (venta.origen !== "camioneta") {
    for (const [codigo, cantidad] of consumos) {
      await tx.update(productosTable).set({
        stock: sql`${productosTable.stock} + ${cantidad}`,
        actualizadoEn: new Date(),
      }).where(eq(productosTable.codigo, codigo));
    }
    return;
  }

  const [camioneta] = await tx
    .select({ id: camionetasTable.id })
    .from(camionetasTable)
    .where(sql`lower(${camionetasTable.nombre}) = lower(${venta.vendedor})`);
  if (!camioneta) return;

  for (const [codigo, cantidad] of consumos) {
    await tx.insert(stockCamionetaTable)
      .values({ camionetaId: camioneta.id, productoCodigo: codigo, cantidad })
      .onConflictDoUpdate({
        target: [stockCamionetaTable.camionetaId, stockCamionetaTable.productoCodigo],
        set: { cantidad: sql`${stockCamionetaTable.cantidad} + ${cantidad}` },
      });
  }
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

router.delete("/dia/:fecha", requireAdmin, async (req, res) => {
  const { fecha } = req.params;

  const ventasDia = await db
    .select()
    .from(ventasTable)
    .where(sql`DATE(${ventasTable.fecha}) = ${fecha}`);

  await db.transaction(async tx => {
    for (const venta of ventasDia) {
      const items = await tx.select().from(itemsVentaTable).where(eq(itemsVentaTable.ventaId, venta.id));
      await restaurarStockVenta(tx, venta, items);
      await tx.delete(itemsVentaTable).where(eq(itemsVentaTable.ventaId, venta.id));
      await tx.delete(ventasTable).where(eq(ventasTable.id, venta.id));
    }
  });

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

  const { vendedor, items, combos = [] } = parsed.data;
  if (items.length === 0 && combos.length === 0) {
    res.status(400).json({ error: "Agregá al menos un producto o combo" });
    return;
  }

  try {
    const combosPreparados = await prepararCombos(combos);
    const requeridos = new Map<string, number>();
    for (const item of items) {
      if (!Number.isInteger(item.cantidad) || item.cantidad < 1) throw new Error("La cantidad de un producto no es válida");
      requeridos.set(item.productoCodigo, (requeridos.get(item.productoCodigo) ?? 0) + item.cantidad);
    }
    for (const combo of combosPreparados) {
      for (const seleccion of combo.selecciones) {
        requeridos.set(seleccion.productoCodigo, (requeridos.get(seleccion.productoCodigo) ?? 0) + seleccion.cantidad);
      }
    }

    const productos = await db.select().from(productosTable).where(inArray(productosTable.codigo, Array.from(requeridos.keys())));
    if (productos.length !== requeridos.size) throw new Error("Uno o más productos ya no existen");
    const porCodigo = new Map(productos.map(producto => [producto.codigo, producto]));

    const lineas = items.map(item => {
      const producto = porCodigo.get(item.productoCodigo)!;
      const precioUnitario = Number(producto.precioVenta);
      const precioCosto = Number(producto.precioCosto);
      return {
        productoCodigo: producto.codigo,
        productoNombre: producto.nombre,
        cantidad: item.cantidad,
        precioUnitario: String(precioUnitario),
        precioCosto: String(precioCosto),
        subtotal: String(precioUnitario * item.cantidad),
        tipo: "producto",
        comboId: null,
        selecciones: [],
      };
    });
    const lineasCombo = combosPreparados.map(combo => ({
      productoCodigo: combo.codigoLinea,
      productoNombre: combo.nombreLinea,
      cantidad: 1,
      precioUnitario: String(combo.precioVenta),
      precioCosto: String(combo.costoTotal),
      subtotal: String(combo.precioVenta),
      tipo: "combo",
      comboId: combo.comboId,
      selecciones: combo.selecciones,
    }));
    const todasLasLineas = [...lineas, ...lineasCombo];
    const total = todasLasLineas.reduce((suma, linea) => suma + Number(linea.subtotal), 0);
    const costoTotal = todasLasLineas.reduce((suma, linea) => suma + Number(linea.precioCosto) * linea.cantidad, 0);

    const venta = await db.transaction(async tx => {
      for (const [codigo, cantidad] of requeridos) {
        const producto = porCodigo.get(codigo)!;
        const actualizados = await tx.update(productosTable)
          .set({ stock: sql`${productosTable.stock} - ${cantidad}`, actualizadoEn: new Date() })
          .where(and(eq(productosTable.codigo, codigo), gte(productosTable.stock, cantidad)))
          .returning({ codigo: productosTable.codigo });
        if (actualizados.length === 0) throw new Error(`Stock insuficiente para ${producto.nombre}. Stock disponible: ${producto.stock}`);
      }
      const [creada] = await tx.insert(ventasTable).values({
        vendedor,
        total: String(total),
        ganancia: String(total - costoTotal),
      }).returning();
      await tx.insert(itemsVentaTable).values(todasLasLineas.map(linea => ({ ventaId: creada.id, ...linea })));
      return creada;
    });

    return res.status(201).json(await ventaConItems(venta));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo registrar la venta" });
  }
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
router.delete("/:id", requireAdmin, async (req, res) => {
  const parsed = EliminarVentaParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "ID inválido" });
  const id = parsed.data.id;

  const [venta] = await db.select().from(ventasTable).where(eq(ventasTable.id, id));
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });

  await db.transaction(async tx => {
    const items = await tx.select().from(itemsVentaTable).where(eq(itemsVentaTable.ventaId, id));
    await restaurarStockVenta(tx, venta, items);
    await tx.delete(itemsVentaTable).where(eq(itemsVentaTable.ventaId, id));
    await tx.delete(ventasTable).where(eq(ventasTable.id, id));
  });

  return res.json({ mensaje: "Venta eliminada" });
});

export default router;
