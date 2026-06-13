import { Router } from "express";
import { db } from "@workspace/db";
import { ventasTable, itemsVentaTable, comprasTable, productosTable, proveedoresTable } from "@workspace/db";
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

  const costoMes = await db
    .select({
      vendedor: ventasTable.vendedor,
      costoTotal: sql<number>`sum(${itemsVentaTable.precioCosto}::numeric * ${itemsVentaTable.cantidad})`,
    })
    .from(itemsVentaTable)
    .innerJoin(ventasTable, eq(itemsVentaTable.ventaId, ventasTable.id))
    .where(gte(ventasTable.fecha, inicioMesActual()))
    .groupBy(ventasTable.vendedor);

  const costoHoy = await db
    .select({
      vendedor: ventasTable.vendedor,
      costoTotal: sql<number>`sum(${itemsVentaTable.precioCosto}::numeric * ${itemsVentaTable.cantidad})`,
    })
    .from(itemsVentaTable)
    .innerJoin(ventasTable, eq(itemsVentaTable.ventaId, ventasTable.id))
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
      costoMes: Number(costoMes.find(r => r.vendedor === v)?.costoTotal ?? 0),
      hoy: {
        cantidadVentas: Number(hoy?.cantidadVentasHoy ?? 0),
        totalVentas: Number(hoy?.totalHoy ?? 0),
        ganancia: Number(hoy?.gananciaHoy ?? 0),
        costo: Number(costoHoy.find(r => r.vendedor === v)?.costoTotal ?? 0),
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

router.get("/por-proveedor", async (req, res) => {
  const rows = await db
    .select({
      proveedorId: productosTable.proveedorId,
      proveedorNombre: proveedoresTable.nombre,
      productoCodigo: itemsVentaTable.productoCodigo,
      productoNombre: itemsVentaTable.productoNombre,
      cantidad: sql<number>`sum(${itemsVentaTable.cantidad})`,
      costoTotal: sql<number>`sum(${itemsVentaTable.precioCosto}::numeric * ${itemsVentaTable.cantidad})`,
      ingresos: sql<number>`sum(${itemsVentaTable.subtotal}::numeric)`,
      ganancia: sql<number>`sum((${itemsVentaTable.precioUnitario}::numeric - ${itemsVentaTable.precioCosto}::numeric) * ${itemsVentaTable.cantidad})`,
    })
    .from(itemsVentaTable)
    .innerJoin(ventasTable, eq(itemsVentaTable.ventaId, ventasTable.id))
    .innerJoin(productosTable, eq(itemsVentaTable.productoCodigo, productosTable.codigo))
    .leftJoin(proveedoresTable, eq(productosTable.proveedorId, proveedoresTable.id))
    .where(gte(ventasTable.fecha, inicioMesActual()))
    .groupBy(productosTable.proveedorId, proveedoresTable.nombre, itemsVentaTable.productoCodigo, itemsVentaTable.productoNombre)
    .orderBy(proveedoresTable.nombre, desc(sql`sum(${itemsVentaTable.cantidad})`));

  const proveedoresMap = new Map<string, {
    proveedorId: number | null;
    proveedorNombre: string;
    costoTotal: number;
    ingresos: number;
    ganancia: number;
    productos: { codigo: string; nombre: string; cantidad: number; costoTotal: number; ingresos: number; ganancia: number }[];
  }>();

  for (const r of rows) {
    const key = r.proveedorNombre ?? "Sin proveedor";
    if (!proveedoresMap.has(key)) {
      proveedoresMap.set(key, { proveedorId: r.proveedorId ?? null, proveedorNombre: key, costoTotal: 0, ingresos: 0, ganancia: 0, productos: [] });
    }
    const entry = proveedoresMap.get(key)!;
    const costo = Number(r.costoTotal ?? 0);
    const ingreso = Number(r.ingresos ?? 0);
    const gan = Number(r.ganancia ?? 0);
    entry.costoTotal += costo;
    entry.ingresos += ingreso;
    entry.ganancia += gan;
    entry.productos.push({ codigo: r.productoCodigo, nombre: r.productoNombre, cantidad: Number(r.cantidad), costoTotal: costo, ingresos: ingreso, ganancia: gan });
  }

  return res.json(Array.from(proveedoresMap.values()));
});

router.get("/cierre-mes", async (req, res) => {
  const inicio = inicioMesActual();
  const now = new Date();
  const mes = now.toLocaleString("es-AR", { month: "long", year: "numeric" });

  const [resumenVentas] = await db
    .select({
      totalVentas: sql<number>`coalesce(sum(${ventasTable.total}::numeric), 0)`,
      totalGanancia: sql<number>`coalesce(sum(${ventasTable.ganancia}::numeric), 0)`,
      cantidadVentas: sql<number>`count(*)`,
    })
    .from(ventasTable)
    .where(gte(ventasTable.fecha, inicio));

  const costoMesRows = await db
    .select({
      costoTotal: sql<number>`coalesce(sum(${itemsVentaTable.precioCosto}::numeric * ${itemsVentaTable.cantidad}), 0)`,
    })
    .from(itemsVentaTable)
    .innerJoin(ventasTable, eq(itemsVentaTable.ventaId, ventasTable.id))
    .where(gte(ventasTable.fecha, inicio));

  const proveedorRows = await db
    .select({
      proveedorNombre: proveedoresTable.nombre,
      productoCodigo: itemsVentaTable.productoCodigo,
      productoNombre: itemsVentaTable.productoNombre,
      cantidad: sql<number>`sum(${itemsVentaTable.cantidad})`,
      costoTotal: sql<number>`sum(${itemsVentaTable.precioCosto}::numeric * ${itemsVentaTable.cantidad})`,
      ingresos: sql<number>`sum(${itemsVentaTable.subtotal}::numeric)`,
      ganancia: sql<number>`sum((${itemsVentaTable.precioUnitario}::numeric - ${itemsVentaTable.precioCosto}::numeric) * ${itemsVentaTable.cantidad})`,
    })
    .from(itemsVentaTable)
    .innerJoin(ventasTable, eq(itemsVentaTable.ventaId, ventasTable.id))
    .innerJoin(productosTable, eq(itemsVentaTable.productoCodigo, productosTable.codigo))
    .leftJoin(proveedoresTable, eq(productosTable.proveedorId, proveedoresTable.id))
    .where(gte(ventasTable.fecha, inicio))
    .groupBy(proveedoresTable.nombre, itemsVentaTable.productoCodigo, itemsVentaTable.productoNombre)
    .orderBy(proveedoresTable.nombre, desc(sql`sum(${itemsVentaTable.cantidad})`));

  const vendedorRows = await db
    .select({
      vendedor: ventasTable.vendedor,
      totalVentas: sql<number>`sum(${ventasTable.total}::numeric)`,
      ganancia: sql<number>`sum(${ventasTable.ganancia}::numeric)`,
      cantidadVentas: sql<number>`count(*)`,
      costoTotal: sql<number>`sum(${itemsVentaTable.precioCosto}::numeric * ${itemsVentaTable.cantidad})`,
    })
    .from(ventasTable)
    .innerJoin(itemsVentaTable, eq(itemsVentaTable.ventaId, ventasTable.id))
    .where(gte(ventasTable.fecha, inicio))
    .groupBy(ventasTable.vendedor);

  const provMap = new Map<string, { proveedorNombre: string; costoTotal: number; ingresos: number; ganancia: number; productos: { nombre: string; cantidad: number; costoTotal: number; ingresos: number; ganancia: number }[] }>();
  for (const r of proveedorRows) {
    const key = r.proveedorNombre ?? "Sin proveedor";
    if (!provMap.has(key)) provMap.set(key, { proveedorNombre: key, costoTotal: 0, ingresos: 0, ganancia: 0, productos: [] });
    const e = provMap.get(key)!;
    const c = Number(r.costoTotal ?? 0), ing = Number(r.ingresos ?? 0), gan = Number(r.ganancia ?? 0);
    e.costoTotal += c; e.ingresos += ing; e.ganancia += gan;
    e.productos.push({ nombre: r.productoNombre, cantidad: Number(r.cantidad), costoTotal: c, ingresos: ing, ganancia: gan });
  }

  return res.json({
    mes,
    totalVentas: Number(resumenVentas?.totalVentas ?? 0),
    totalGanancia: Number(resumenVentas?.totalGanancia ?? 0),
    totalCosto: Number(costoMesRows[0]?.costoTotal ?? 0),
    cantidadVentas: Number(resumenVentas?.cantidadVentas ?? 0),
    porProveedor: Array.from(provMap.values()),
    porVendedor: vendedorRows.map(r => ({
      vendedor: r.vendedor,
      totalVentas: Number(r.totalVentas),
      ganancia: Number(r.ganancia),
      costoTotal: Number(r.costoTotal),
      cantidadVentas: Number(r.cantidadVentas),
    })),
  });
});

router.get("/cierre-mes/exportar", async (req, res) => {
  const inicio = inicioMesActual();
  const now = new Date();
  const mes = now.toLocaleString("es-AR", { month: "long", year: "numeric" });
  const mesSlug = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [resumenVentas] = await db
    .select({
      totalVentas: sql<number>`coalesce(sum(${ventasTable.total}::numeric), 0)`,
      totalGanancia: sql<number>`coalesce(sum(${ventasTable.ganancia}::numeric), 0)`,
      cantidadVentas: sql<number>`count(*)`,
    })
    .from(ventasTable).where(gte(ventasTable.fecha, inicio));

  const costoRows = await db
    .select({ costoTotal: sql<number>`coalesce(sum(${itemsVentaTable.precioCosto}::numeric * ${itemsVentaTable.cantidad}), 0)` })
    .from(itemsVentaTable)
    .innerJoin(ventasTable, eq(itemsVentaTable.ventaId, ventasTable.id))
    .where(gte(ventasTable.fecha, inicio));

  const proveedorRows = await db
    .select({
      proveedorNombre: proveedoresTable.nombre,
      productoNombre: itemsVentaTable.productoNombre,
      cantidad: sql<number>`sum(${itemsVentaTable.cantidad})`,
      costoTotal: sql<number>`sum(${itemsVentaTable.precioCosto}::numeric * ${itemsVentaTable.cantidad})`,
      ingresos: sql<number>`sum(${itemsVentaTable.subtotal}::numeric)`,
      ganancia: sql<number>`sum((${itemsVentaTable.precioUnitario}::numeric - ${itemsVentaTable.precioCosto}::numeric) * ${itemsVentaTable.cantidad})`,
    })
    .from(itemsVentaTable)
    .innerJoin(ventasTable, eq(itemsVentaTable.ventaId, ventasTable.id))
    .innerJoin(productosTable, eq(itemsVentaTable.productoCodigo, productosTable.codigo))
    .leftJoin(proveedoresTable, eq(productosTable.proveedorId, proveedoresTable.id))
    .where(gte(ventasTable.fecha, inicio))
    .groupBy(proveedoresTable.nombre, itemsVentaTable.productoNombre)
    .orderBy(proveedoresTable.nombre, desc(sql`sum(${itemsVentaTable.cantidad})`));

  const vendedorRows = await db
    .select({
      vendedor: ventasTable.vendedor,
      totalVentas: sql<number>`sum(${ventasTable.total}::numeric)`,
      ganancia: sql<number>`sum(${ventasTable.ganancia}::numeric)`,
      costoTotal: sql<number>`sum(${itemsVentaTable.precioCosto}::numeric * ${itemsVentaTable.cantidad})`,
      cantidadVentas: sql<number>`count(distinct ${ventasTable.id})`,
    })
    .from(ventasTable)
    .innerJoin(itemsVentaTable, eq(itemsVentaTable.ventaId, ventasTable.id))
    .where(gte(ventasTable.fecha, inicio))
    .groupBy(ventasTable.vendedor);

  const totalVentas = Number(resumenVentas?.totalVentas ?? 0);
  const totalGanancia = Number(resumenVentas?.totalGanancia ?? 0);
  const totalCosto = Number(costoRows[0]?.costoTotal ?? 0);

  const lines: string[] = [];
  const fmt = (n: number) => n.toFixed(2);

  lines.push(`"CIERRE DE MES — ${mes.toUpperCase()}"`);
  lines.push(`"Generado el","${now.toLocaleDateString("es-AR")} ${now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}"`);
  lines.push("");
  lines.push('"RESUMEN GENERAL"');
  lines.push(`"Total vendido","${fmt(totalVentas)}"`);
  lines.push(`"Total costo productos","${fmt(totalCosto)}"`);
  lines.push(`"Ganancia neta","${fmt(totalGanancia)}"`);
  lines.push(`"Cantidad de ventas","${resumenVentas?.cantidadVentas ?? 0}"`);
  lines.push("");
  lines.push('"POR VENDEDOR"');
  lines.push('"Vendedor","Ventas realizadas","Total vendido","Costo","Ganancia"');
  for (const v of vendedorRows) {
    lines.push(`"${v.vendedor}","${v.cantidadVentas}","${fmt(Number(v.totalVentas))}","${fmt(Number(v.costoTotal))}","${fmt(Number(v.ganancia))}"`);
  }
  lines.push("");
  lines.push('"POR PROVEEDOR"');
  lines.push('"Proveedor","Producto","Cantidad","Costo total","Vendido","Ganancia"');

  let currentProv = "";
  let provCosto = 0, provIngresos = 0, provGanancia = 0;
  for (const r of proveedorRows) {
    const prov = r.proveedorNombre ?? "Sin proveedor";
    if (prov !== currentProv) {
      if (currentProv) {
        lines.push(`"SUBTOTAL ${currentProv}","","","${fmt(provCosto)}","${fmt(provIngresos)}","${fmt(provGanancia)}"`);
        lines.push("");
      }
      currentProv = prov;
      provCosto = 0; provIngresos = 0; provGanancia = 0;
    }
    const c = Number(r.costoTotal ?? 0), ing = Number(r.ingresos ?? 0), gan = Number(r.ganancia ?? 0);
    provCosto += c; provIngresos += ing; provGanancia += gan;
    lines.push(`"${prov}","${r.productoNombre}","${r.cantidad}","${fmt(c)}","${fmt(ing)}","${fmt(gan)}"`);
  }
  if (currentProv) {
    lines.push(`"SUBTOTAL ${currentProv}","","","${fmt(provCosto)}","${fmt(provIngresos)}","${fmt(provGanancia)}"`);
  }
  lines.push("");
  lines.push(`"TOTAL GENERAL","","","${fmt(totalCosto)}","${fmt(totalVentas)}","${fmt(totalGanancia)}"`);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="cierre-mes-${mesSlug}.csv"`);
  return res.send("\uFEFF" + lines.join("\n"));
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
