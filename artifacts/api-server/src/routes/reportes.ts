import { Router } from "express";
import { db } from "@workspace/db";
import { ventasTable, itemsVentaTable, comprasTable, productosTable } from "@workspace/db";
import { eq, gte, lte, and, sql, desc, SQL } from "drizzle-orm";
import { ObtenerResumenQueryParams, ObtenerVentasPorDiaQueryParams } from "@workspace/api-zod";

const router = Router();

function inicioMesActual(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

router.get("/resumen", async (req, res) => {
  const parsed = ObtenerResumenQueryParams.safeParse(req.query);
  const conditions: SQL[] = [];

  if (parsed.success && (parsed.data.fechaDesde || parsed.data.fechaHasta)) {
    if (parsed.data.fechaDesde) conditions.push(gte(ventasTable.fecha, new Date(parsed.data.fechaDesde)));
    if (parsed.data.fechaHasta) conditions.push(lte(ventasTable.fecha, new Date(parsed.data.fechaHasta)));
  } else {
    conditions.push(gte(ventasTable.fecha, inicioMesActual()));
  }

  const ventasResult = await db
    .select({
      totalVentas: sql<number>`coalesce(sum(${ventasTable.total}::numeric), 0)`,
      gananciaTotal: sql<number>`coalesce(sum(${ventasTable.ganancia}::numeric), 0)`,
      cantidadVentas: sql<number>`count(*)`,
    })
    .from(ventasTable)
    .where(and(...conditions));

  const comprasResult = await db
    .select({
      totalInvertido: sql<number>`coalesce(sum(${comprasTable.totalInvertido}::numeric), 0)`,
      cantidadCompras: sql<number>`count(*)`,
    })
    .from(comprasTable)
    .where(gte(comprasTable.fecha, inicioMesActual()));

  const totalVentas = Number(ventasResult[0]?.totalVentas ?? 0);
  const gananciaTotal = Number(ventasResult[0]?.gananciaTotal ?? 0);
  const cantidadVentas = Number(ventasResult[0]?.cantidadVentas ?? 0);
  const totalInvertido = Number(comprasResult[0]?.totalInvertido ?? 0);
  const cantidadCompras = Number(comprasResult[0]?.cantidadCompras ?? 0);
  const margenPromedio = totalVentas > 0 ? (gananciaTotal / totalVentas) * 100 : 0;

  return res.json({ totalVentas, totalInvertido, gananciaTotal, cantidadVentas, cantidadCompras, margenPromedio });
});

router.get("/top-productos", async (req, res) => {
  const result = await db
    .select({
      codigo: itemsVentaTable.productoCodigo,
      nombre: itemsVentaTable.productoNombre,
      cantidadVendida: sql<number>`sum(${itemsVentaTable.cantidad})`,
      ingresos: sql<number>`sum(${itemsVentaTable.subtotal}::numeric)`,
      ganancia: sql<number>`sum((${itemsVentaTable.precioUnitario}::numeric - ${itemsVentaTable.precioCosto}::numeric) * ${itemsVentaTable.cantidad})`,
    })
    .from(itemsVentaTable)
    .groupBy(itemsVentaTable.productoCodigo, itemsVentaTable.productoNombre)
    .orderBy(desc(sql`sum(${itemsVentaTable.cantidad})`))
    .limit(10);

  return res.json(result.map(r => ({
    ...r,
    cantidadVendida: Number(r.cantidadVendida),
    ingresos: Number(r.ingresos),
    ganancia: Number(r.ganancia),
  })));
});

router.get("/ventas-por-dia", async (req, res) => {
  const parsed = ObtenerVentasPorDiaQueryParams.safeParse(req.query);
  const dias = parsed.success && parsed.data.dias ? Number(parsed.data.dias) : 30;

  const result = await db
    .select({
      fecha: sql<string>`DATE(${ventasTable.fecha})`,
      totalVentas: sql<number>`sum(${ventasTable.total}::numeric)`,
      cantidadVentas: sql<number>`count(*)`,
      ganancia: sql<number>`sum(${ventasTable.ganancia}::numeric)`,
    })
    .from(ventasTable)
    .where(gte(ventasTable.fecha, new Date(Date.now() - dias * 86400000)))
    .groupBy(sql`DATE(${ventasTable.fecha})`)
    .orderBy(sql`DATE(${ventasTable.fecha})`);

  return res.json(result.map(r => ({
    fecha: r.fecha,
    totalVentas: Number(r.totalVentas),
    cantidadVentas: Number(r.cantidadVentas),
    ganancia: Number(r.ganancia),
  })));
});

router.get("/vendedores", async (req, res) => {
  const result = await db
    .select({
      vendedor: ventasTable.vendedor,
      cantidadVentas: sql<number>`count(*)`,
      totalVentas: sql<number>`sum(${ventasTable.total}::numeric)`,
      gananciaGenerada: sql<number>`sum(${ventasTable.ganancia}::numeric)`,
    })
    .from(ventasTable)
    .groupBy(ventasTable.vendedor)
    .orderBy(desc(sql`sum(${ventasTable.total}::numeric)`));

  return res.json(result.map(r => ({
    ...r,
    cantidadVentas: Number(r.cantidadVentas),
    totalVentas: Number(r.totalVentas),
    gananciaGenerada: Number(r.gananciaGenerada),
  })));
});

router.get("/vendedores-detalle", async (req, res) => {
  const hoyStr = new Date().toISOString().slice(0, 10);
  const inicioDia = new Date(`${hoyStr}T00:00:00.000Z`);
  const finDia = new Date(`${hoyStr}T23:59:59.999Z`);

  const resumenGlobal = await db
    .select({
      vendedor: ventasTable.vendedor,
      cantidadVentas: sql<number>`count(*)`,
      totalVentas: sql<number>`sum(${ventasTable.total}::numeric)`,
      gananciaGenerada: sql<number>`sum(${ventasTable.ganancia}::numeric)`,
    })
    .from(ventasTable)
    .where(gte(ventasTable.fecha, inicioMesActual()))
    .groupBy(ventasTable.vendedor);

  const resumenHoy = await db
    .select({
      vendedor: ventasTable.vendedor,
      cantidadVentasHoy: sql<number>`count(*)`,
      totalHoy: sql<number>`sum(${ventasTable.total}::numeric)`,
      gananciaHoy: sql<number>`sum(${ventasTable.ganancia}::numeric)`,
    })
    .from(ventasTable)
    .where(and(gte(ventasTable.fecha, inicioDia), lte(ventasTable.fecha, finDia)))
    .groupBy(ventasTable.vendedor);

  const productosGlobal = await db
    .select({
      vendedor: ventasTable.vendedor,
      productoNombre: itemsVentaTable.productoNombre,
      cantidad: sql<number>`sum(${itemsVentaTable.cantidad})`,
      ingresos: sql<number>`sum(${itemsVentaTable.subtotal}::numeric)`,
      ganancia: sql<number>`sum((${itemsVentaTable.precioUnitario}::numeric - ${itemsVentaTable.precioCosto}::numeric) * ${itemsVentaTable.cantidad})`,
    })
    .from(itemsVentaTable)
    .innerJoin(ventasTable, eq(itemsVentaTable.ventaId, ventasTable.id))
    .where(gte(ventasTable.fecha, inicioMesActual()))
    .groupBy(ventasTable.vendedor, itemsVentaTable.productoNombre)
    .orderBy(desc(sql`sum(${itemsVentaTable.cantidad})`));

  const productosHoy = await db
    .select({
      vendedor: ventasTable.vendedor,
      productoNombre: itemsVentaTable.productoNombre,
      cantidad: sql<number>`sum(${itemsVentaTable.cantidad})`,
      ingresos: sql<number>`sum(${itemsVentaTable.subtotal}::numeric)`,
      ganancia: sql<number>`sum((${itemsVentaTable.precioUnitario}::numeric - ${itemsVentaTable.precioCosto}::numeric) * ${itemsVentaTable.cantidad})`,
    })
    .from(itemsVentaTable)
    .innerJoin(ventasTable, eq(itemsVentaTable.ventaId, ventasTable.id))
    .where(and(gte(ventasTable.fecha, inicioDia), lte(ventasTable.fecha, finDia)))
    .groupBy(ventasTable.vendedor, itemsVentaTable.productoNombre)
    .orderBy(desc(sql`sum(${itemsVentaTable.cantidad})`));

  const vendedores = [...new Set([...resumenGlobal.map(r => r.vendedor), ...resumenHoy.map(r => r.vendedor)])];

  const respuesta = vendedores.map(v => {
    const global = resumenGlobal.find(r => r.vendedor === v);
    const hoy = resumenHoy.find(r => r.vendedor === v);
    return {
      vendedor: v,
      cantidadVentas: Number(global?.cantidadVentas ?? 0),
      totalVentas: Number(global?.totalVentas ?? 0),
      gananciaGenerada: Number(global?.gananciaGenerada ?? 0),
      hoy: {
        cantidadVentas: Number(hoy?.cantidadVentasHoy ?? 0),
        totalVentas: Number(hoy?.totalHoy ?? 0),
        ganancia: Number(hoy?.gananciaHoy ?? 0),
      },
      topProductosGlobal: productosGlobal
        .filter(p => p.vendedor === v)
        .slice(0, 5)
        .map(p => ({ nombre: p.productoNombre, cantidad: Number(p.cantidad), ingresos: Number(p.ingresos), ganancia: Number(p.ganancia) })),
      productosHoy: productosHoy
        .filter(p => p.vendedor === v)
        .map(p => ({ nombre: p.productoNombre, cantidad: Number(p.cantidad), ingresos: Number(p.ingresos), ganancia: Number(p.ganancia) })),
    };
  });

  return res.json(respuesta);
});

router.get("/stock-bajo", async (req, res) => {
  const productos = await db
    .select()
    .from(productosTable)
    .where(sql`${productosTable.stock} <= ${productosTable.stockMinimo}`);

  return res.json(productos.map(p => ({
    ...p,
    precioVenta: Number(p.precioVenta),
    precioCosto: Number(p.precioCosto),
    creadoEn: p.creadoEn.toISOString(),
    actualizadoEn: p.actualizadoEn.toISOString(),
    proveedorNombre: null,
  })));
});

export default router;
