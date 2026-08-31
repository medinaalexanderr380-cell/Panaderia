import { Router } from "express";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  db,
  camionetasTable,
  migracionesCamionetasTable,
  stockCamionetaTable,
  productosTable,
  perdidasTable,
  ventasTable,
  itemsVentaTable,
} from "@workspace/db";
import {
  CrearCamionetaBody,
  EliminarCamionetaParams,
  EliminarCamionetaResponse,
  ListarCamionetasResponse,
} from "@workspace/api-zod";
import {
  getCamionetaCodigoAutorizado,
  requireAdmin,
  requireCamionetaAccess,
} from "../middleware/auth";
import { prepararCombos, type ComboSolicitado } from "../lib/combo-ventas";

const router = Router();

type OperacionItem = { productoCodigo: string; cantidad: number };
type CargaItem = OperacionItem & { productoNombre: string; proveedor?: string };

function normalizarCodigo(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36) || "camioneta";
}

async function migrarStockLegacySiHaceFalta(): Promise<void> {
  const [migracion] = await db
    .select({ id: migracionesCamionetasTable.id })
    .from(migracionesCamionetasTable)
    .where(eq(migracionesCamionetasTable.version, "stock-dinamico-v1"));
  if (migracion) return;

  await db.transaction(async (tx) => {
    const [migracionEnCurso] = await tx
      .select({ id: migracionesCamionetasTable.id })
      .from(migracionesCamionetasTable)
      .where(eq(migracionesCamionetasTable.version, "stock-dinamico-v1"));
    if (migracionEnCurso) return;

    await tx.insert(camionetasTable).values([
      { codigo: "michel", nombre: "Michel" },
      { codigo: "david", nombre: "David" },
    ]).onConflictDoNothing();

    await tx.execute(sql`
      INSERT INTO stock_camioneta (camioneta_id, producto_codigo, cantidad)
      SELECT
        c.id,
        p.codigo,
        CASE c.codigo
          WHEN 'michel' THEN p.stock_camioneta_michel
          WHEN 'david' THEN p.stock_camioneta_david
          ELSE 0
        END
      FROM camionetas c
      CROSS JOIN productos p
      WHERE c.codigo IN ('michel', 'david')
        AND CASE c.codigo
          WHEN 'michel' THEN p.stock_camioneta_michel
          WHEN 'david' THEN p.stock_camioneta_david
          ELSE 0
        END > 0
      ON CONFLICT (camioneta_id, producto_codigo) DO NOTHING
    `);

    await tx.update(productosTable).set({
      stockCamionetaMichel: 0,
      stockCamionetaDavid: 0,
      actualizadoEn: new Date(),
    });

    await tx.insert(migracionesCamionetasTable).values({ version: "stock-dinamico-v1" });
  });
}

async function obtenerCamioneta(codigo: string) {
  await migrarStockLegacySiHaceFalta();
  const [camioneta] = await db
    .select()
    .from(camionetasTable)
    .where(eq(camionetasTable.codigo, codigo.toLowerCase()));
  return camioneta;
}

async function cantidadEnCamioneta(camionetaId: number, productoCodigo: string) {
  const [row] = await db
    .select({ cantidad: stockCamionetaTable.cantidad })
    .from(stockCamionetaTable)
    .where(
      sql`${stockCamionetaTable.camionetaId} = ${camionetaId}
        AND ${stockCamionetaTable.productoCodigo} = ${productoCodigo}`,
    );
  return row?.cantidad ?? 0;
}

async function sumarStockCamioneta(camionetaId: number, productoCodigo: string, cantidad: number) {
  await db
    .insert(stockCamionetaTable)
    .values({ camionetaId, productoCodigo, cantidad })
    .onConflictDoUpdate({
      target: [stockCamionetaTable.camionetaId, stockCamionetaTable.productoCodigo],
      set: { cantidad: sql`${stockCamionetaTable.cantidad} + ${cantidad}` },
    });
}

async function restarStockCamioneta(camionetaId: number, productoCodigo: string, cantidad: number) {
  await db
    .update(stockCamionetaTable)
    .set({ cantidad: sql`${stockCamionetaTable.cantidad} - ${cantidad}` })
    .where(
      sql`${stockCamionetaTable.camionetaId} = ${camionetaId}
        AND ${stockCamionetaTable.productoCodigo} = ${productoCodigo}`,
    );

  await db
    .delete(stockCamionetaTable)
    .where(and(
      eq(stockCamionetaTable.camionetaId, camionetaId),
      eq(stockCamionetaTable.productoCodigo, productoCodigo),
      lte(stockCamionetaTable.cantidad, 0),
    ));
}

router.get("/camionetas", async (_req, res): Promise<void> => {
  await migrarStockLegacySiHaceFalta();
  const rows = await db
    .select({
      id: camionetasTable.id,
      codigo: camionetasTable.codigo,
      nombre: camionetasTable.nombre,
      activo: camionetasTable.activo,
      creadoEn: camionetasTable.creadoEn,
      stockTotal: sql<number>`coalesce(sum(${stockCamionetaTable.cantidad}), 0)`,
    })
    .from(camionetasTable)
    .leftJoin(stockCamionetaTable, eq(stockCamionetaTable.camionetaId, camionetasTable.id))
    .where(eq(camionetasTable.activo, true))
    .groupBy(camionetasTable.id)
    .orderBy(camionetasTable.nombre);

  res.json(ListarCamionetasResponse.parse(rows.map(row => ({
    ...row,
    stockTotal: Number(row.stockTotal),
    creadoEn: row.creadoEn.toISOString(),
  }))));
});

router.post("/camionetas", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CrearCamionetaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const nombre = parsed.data.nombre.trim();
  let codigo = normalizarCodigo(nombre);
  for (let suffix = 2; ; suffix += 1) {
    const [existente] = await db.select({ id: camionetasTable.id }).from(camionetasTable).where(eq(camionetasTable.codigo, codigo));
    if (!existente) break;
    codigo = `${normalizarCodigo(nombre)}-${suffix}`;
  }

  const [camioneta] = await db.insert(camionetasTable).values({ codigo, nombre }).returning();
  res.status(201).json({
    ...camioneta,
    stockTotal: 0,
    creadoEn: camioneta.creadoEn.toISOString(),
  });
});

router.delete("/camionetas/:codigo", requireAdmin, async (req, res): Promise<void> => {
  const params = EliminarCamionetaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const camioneta = await obtenerCamioneta(params.data.codigo);
  if (!camioneta) {
    res.status(404).json({ error: "Camioneta no encontrada" });
    return;
  }

  const [stock] = await db
    .select({ total: sql<number>`coalesce(sum(${stockCamionetaTable.cantidad}), 0)` })
    .from(stockCamionetaTable)
    .where(eq(stockCamionetaTable.camionetaId, camioneta.id));

  if (Number(stock?.total ?? 0) > 0) {
    res.status(409).json({ error: "No se puede borrar una camioneta que todavía tiene productos cargados" });
    return;
  }

  await db.delete(camionetasTable).where(eq(camionetasTable.id, camioneta.id));
  res.json(EliminarCamionetaResponse.parse({ mensaje: "Camioneta eliminada" }));
});

router.get("/stock", async (req, res): Promise<void> => {
  const codigo = typeof req.query["vendedor"] === "string" ? req.query["vendedor"] : "";
  const camioneta = await obtenerCamioneta(codigo);
  if (!camioneta) {
    res.status(404).json({ error: "Camioneta no encontrada" });
    return;
  }

  const stock = await db
    .select({
      codigo: productosTable.codigo,
      nombre: productosTable.nombre,
      descripcion: productosTable.descripcion,
      stockCamioneta: stockCamionetaTable.cantidad,
      precioVenta: productosTable.precioVenta,
      precioCosto: productosTable.precioCosto,
      unidad: productosTable.unidad,
    })
    .from(stockCamionetaTable)
    .innerJoin(productosTable, eq(stockCamionetaTable.productoCodigo, productosTable.codigo))
    .where(eq(stockCamionetaTable.camionetaId, camioneta.id))
    .orderBy(productosTable.nombre);

  res.json(stock
    .filter(item => item.stockCamioneta > 0)
    .map(item => ({
      ...item,
      precioVenta: Number(item.precioVenta),
      precioCosto: Number(item.precioCosto),
    })));
});

router.post("/cargar", requireCamionetaAccess, async (req, res): Promise<void> => {
  const { items } = req.body as { vendedor?: string; items: CargaItem[] };
  const vendedor = getCamionetaCodigoAutorizado(req);
  const camioneta = await obtenerCamioneta(vendedor ?? "");
  if (!camioneta) {
    res.status(404).json({ error: "Camioneta no encontrada" });
    return;
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Se requieren productos para cargar" });
    return;
  }

  const resultados: Array<{ codigo: string; nombre: string }> = [];
  for (const item of items) {
    if (!item.productoCodigo?.trim() || !item.productoNombre?.trim() || !Number.isInteger(item.cantidad) || item.cantidad <= 0) {
      res.status(400).json({ error: "Producto o cantidad inválidos" });
      return;
    }

    const codigo = item.productoCodigo.trim().toUpperCase();
    const [producto] = await db.select().from(productosTable).where(eq(productosTable.codigo, codigo));

    if (producto) {
      if (producto.stock < item.cantidad) {
        res.status(400).json({ error: `Stock insuficiente en depósito para "${producto.nombre}". Disponible: ${producto.stock}` });
        return;
      }
      await db.update(productosTable).set({
        stock: sql`${productosTable.stock} - ${item.cantidad}`,
        actualizadoEn: new Date(),
      }).where(eq(productosTable.codigo, codigo));
      await sumarStockCamioneta(camioneta.id, codigo, item.cantidad);
      resultados.push({ codigo, nombre: producto.nombre });
    } else {
      const [nuevo] = await db.insert(productosTable).values({
        codigo,
        nombre: item.productoNombre.trim(),
        descripcion: "",
        precioVenta: "0",
        precioCosto: "0",
        stock: 0,
        stockCamioneta: 0,
        stockMinimo: 0,
        unidad: "unidad",
      }).returning();
      await sumarStockCamioneta(camioneta.id, nuevo.codigo, item.cantidad);
      resultados.push({ codigo: nuevo.codigo, nombre: nuevo.nombre });
    }
  }

  res.json({ mensaje: "Carga realizada exitosamente", resultados });
});

router.post("/ventas", requireCamionetaAccess, async (req, res): Promise<void> => {
  const { items, combos = [] } = req.body as { vendedor?: string; items: OperacionItem[]; combos?: ComboSolicitado[] };
  const vendedor = getCamionetaCodigoAutorizado(req);
  const camioneta = await obtenerCamioneta(vendedor ?? "");
  if (!camioneta) {
    res.status(404).json({ error: "Camioneta no encontrada" });
    return;
  }
  if (!Array.isArray(items) || (!items.length && !combos.length)) {
    res.status(400).json({ error: "Camioneta y productos requeridos" });
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

    const lineasProducto = items.map(item => {
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
    const lineas = [...lineasProducto, ...lineasCombo];
    const totalVenta = lineas.reduce((total, item) => total + Number(item.subtotal), 0);
    const costoTotal = lineas.reduce((total, item) => total + Number(item.precioCosto) * item.cantidad, 0);

    const venta = await db.transaction(async tx => {
      for (const [codigo, cantidad] of requeridos) {
        const producto = porCodigo.get(codigo)!;
        const actualizados = await tx.update(stockCamionetaTable)
          .set({ cantidad: sql`${stockCamionetaTable.cantidad} - ${cantidad}` })
          .where(and(
            eq(stockCamionetaTable.camionetaId, camioneta.id),
            eq(stockCamionetaTable.productoCodigo, codigo),
            gte(stockCamionetaTable.cantidad, cantidad),
          ))
          .returning({ productoCodigo: stockCamionetaTable.productoCodigo });
        if (actualizados.length === 0) throw new Error(`Stock insuficiente en camioneta para ${producto.nombre}`);
      }
      const [creada] = await tx.insert(ventasTable).values({
        vendedor: camioneta.nombre,
        total: String(totalVenta),
        ganancia: String(totalVenta - costoTotal),
        origen: "camioneta",
      }).returning();
      await tx.insert(itemsVentaTable).values(lineas.map(item => ({ ventaId: creada.id, ...item })));
      for (const [codigo] of requeridos) {
        await tx.delete(stockCamionetaTable).where(and(
          eq(stockCamionetaTable.camionetaId, camioneta.id),
          eq(stockCamionetaTable.productoCodigo, codigo),
          lte(stockCamionetaTable.cantidad, 0),
        ));
      }
      return creada;
    });

    res.status(201).json({ id: venta.id, total: totalVenta, ganancia: totalVenta - costoTotal, origen: "camioneta" });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo registrar la venta" });
  }
});

router.post("/devolver", requireCamionetaAccess, async (req, res): Promise<void> => {
  const { items } = req.body as { vendedor?: string; items: OperacionItem[] };
  const vendedor = getCamionetaCodigoAutorizado(req);
  const camioneta = await obtenerCamioneta(vendedor ?? "");
  if (!camioneta) {
    res.status(404).json({ error: "Camioneta no encontrada" });
    return;
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Se requieren productos para devolver" });
    return;
  }

  for (const item of items) {
    const [producto] = await db.select().from(productosTable).where(eq(productosTable.codigo, item.productoCodigo));
    if (!producto) {
      res.status(404).json({ error: `Producto no encontrado: ${item.productoCodigo}` });
      return;
    }
    const disponible = await cantidadEnCamioneta(camioneta.id, producto.codigo);
    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0 || disponible < item.cantidad) {
      res.status(400).json({ error: `Stock insuficiente en camioneta para ${producto.nombre}. Disponible: ${disponible}` });
      return;
    }
    await db.update(productosTable).set({
      stock: sql`${productosTable.stock} + ${item.cantidad}`,
      actualizadoEn: new Date(),
    }).where(eq(productosTable.codigo, producto.codigo));
    await restarStockCamioneta(camioneta.id, producto.codigo, item.cantidad);
  }

  res.json({ mensaje: "Devolución al depósito realizada exitosamente" });
});

router.post("/caducado", requireCamionetaAccess, async (req, res): Promise<void> => {
  const { productoCodigo, cantidad, origen } = req.body as {
    productoCodigo: string;
    cantidad: number;
    origen: "panaderia" | "camioneta";
    vendedor?: string;
  };
  if (!productoCodigo || !Number.isInteger(cantidad) || cantidad <= 0) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const [producto] = await db.select().from(productosTable).where(eq(productosTable.codigo, productoCodigo));
  if (!producto) {
    res.status(404).json({ error: "Producto no encontrado" });
    return;
  }

  let camionetaId: number | null = null;
  if (origen === "camioneta") {
    const camioneta = await obtenerCamioneta(getCamionetaCodigoAutorizado(req) ?? "");
    if (!camioneta) {
      res.status(404).json({ error: "Camioneta no encontrada" });
      return;
    }
    camionetaId = camioneta.id;
    const disponible = await cantidadEnCamioneta(camioneta.id, producto.codigo);
    if (disponible < cantidad) {
      res.status(400).json({ error: `Stock insuficiente. Disponible: ${disponible}` });
      return;
    }
  } else if (producto.stock < cantidad) {
    res.status(400).json({ error: `Stock insuficiente. Disponible: ${producto.stock}` });
    return;
  }

  const costoTotal = Number(producto.precioCosto) * cantidad;
  await db.insert(perdidasTable).values({
    productoCodigo: producto.codigo,
    productoNombre: producto.nombre,
    cantidad,
    costoTotal: String(costoTotal),
    motivo: "caducado",
    origen: origen || "panaderia",
    registradoPor: getCamionetaCodigoAutorizado(req) || "Sistema",
  });

  if (camionetaId !== null) {
    await restarStockCamioneta(camionetaId, producto.codigo, cantidad);
  } else {
    await db.update(productosTable).set({
      stock: sql`${productosTable.stock} - ${cantidad}`,
      actualizadoEn: new Date(),
    }).where(eq(productosTable.codigo, producto.codigo));
  }

  res.json({ mensaje: "Pérdida registrada", costoTotal });
});

export default router;