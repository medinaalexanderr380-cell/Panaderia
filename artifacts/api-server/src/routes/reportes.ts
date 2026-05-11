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
