import { Router } from "express";
import { db } from "@workspace/db";
import { productosTable, perdidasTable, ventasTable, itemsVentaTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

type Vendedor = "michel" | "david";

function validarVendedor(v: unknown): v is Vendedor {
  return v === "michel" || v === "david";
}

router.get("/stock", async (req, res) => {
  const vendedor = (req.query["vendedor"] as string | undefined)?.toLowerCase();
  if (!validarVendedor(vendedor))
    return res.status(400).json({ error: "Parámetro vendedor requerido (michel o david)" });

  const productos = await db.select().from(productosTable);

  const filtrado = productos
    .filter(p => vendedor === "michel" ? p.stockCamionetaMichel > 0 : p.stockCamionetaDavid > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map(p => ({
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      stockCamioneta: vendedor === "michel" ? p.stockCamionetaMichel : p.stockCamionetaDavid,
      precioVenta: Number(p.precioVenta),
      precioCosto: Number(p.precioCosto),
      unidad: p.unidad,
    }));

  return res.json(filtrado);
});

router.post("/cargar", async (req, res) => {
  const { vendedor, items } = req.body as {
    vendedor: string;
    items: { productoCodigo: string; productoNombre: string; cantidad: number; proveedor?: string }[];
  };

  const v = vendedor?.toLowerCase();
  if (!validarVendedor(v))
    return res.status(400).json({ error: "Vendedor inválido (michel o david)" });
  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "Se requieren items para cargar" });

  const resultados = [];

  for (const item of items) {
    if (!item.productoCodigo?.trim() || !item.productoNombre?.trim() || !item.cantidad || item.cantidad <= 0)
      return res.status(400).json({ error: `Item inválido: ${JSON.stringify(item)}` });

    const codigo = item.productoCodigo.trim().toUpperCase();
    const [producto] = await db.select().from(productosTable).where(eq(productosTable.codigo, codigo));

    let updated;
    if (producto) {
      if (producto.stock < item.cantidad)
        return res.status(400).json({ error: `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}` });

      if (v === "michel") {
        [updated] = await db.update(productosTable).set({
          stock: sql`${productosTable.stock} - ${item.cantidad}`,
          stockCamionetaMichel: sql`${productosTable.stockCamionetaMichel} + ${item.cantidad}`,
          actualizadoEn: new Date(),
        }).where(eq(productosTable.codigo, codigo)).returning();
      } else {
        [updated] = await db.update(productosTable).set({
          stock: sql`${productosTable.stock} - ${item.cantidad}`,
          stockCamionetaDavid: sql`${productosTable.stockCamionetaDavid} + ${item.cantidad}`,
          actualizadoEn: new Date(),
        }).where(eq(productosTable.codigo, codigo)).returning();
      }
    } else {
      [updated] = await db.insert(productosTable).values({
        codigo,
        nombre: item.productoNombre.trim(),
        descripcion: "",
        precioVenta: "0",
        precioCosto: "0",
        stock: 0,
        stockCamioneta: 0,
        stockCamionetaMichel: v === "michel" ? item.cantidad : 0,
        stockCamionetaDavid: v === "david" ? item.cantidad : 0,
        stockMinimo: 0,
        unidad: "unidad",
      }).returning();
    }

    resultados.push({ codigo: updated.codigo, nombre: updated.nombre });
  }

  return res.json({ mensaje: "Carga realizada exitosamente", resultados });
});

router.post("/ventas", async (req, res) => {
  const { vendedor, items } = req.body as { vendedor: string; items: { productoCodigo: string; cantidad: number }[] };
  if (!vendedor || !items || items.length === 0)
    return res.status(400).json({ error: "Vendedor e items requeridos" });

  const v = vendedor.toLowerCase();
  if (!validarVendedor(v))
    return res.status(400).json({ error: "Vendedor inválido" });

  let totalVenta = 0;
  let totalGanancia = 0;
  const itemsDetalle: Array<{ codigo: string; nombre: string; cantidad: number; precioUnitario: number; precioCosto: number; subtotal: number }> = [];

  for (const item of items) {
    const [producto] = await db.select().from(productosTable).where(eq(productosTable.codigo, item.productoCodigo));
    if (!producto) return res.status(404).json({ error: `Producto no encontrado: ${item.productoCodigo}` });

    const stockDisp = v === "michel" ? producto.stockCamionetaMichel : producto.stockCamionetaDavid;
    if (stockDisp < item.cantidad)
      return res.status(400).json({ error: `Stock insuficiente en camioneta de ${vendedor} para ${producto.nombre}. Disponible: ${stockDisp}` });

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
    if (v === "michel") {
      await db.update(productosTable).set({
        stockCamionetaMichel: sql`${productosTable.stockCamionetaMichel} - ${item.cantidad}`,
        actualizadoEn: new Date(),
      }).where(eq(productosTable.codigo, item.codigo));
    } else {
      await db.update(productosTable).set({
        stockCamionetaDavid: sql`${productosTable.stockCamionetaDavid} - ${item.cantidad}`,
        actualizadoEn: new Date(),
      }).where(eq(productosTable.codigo, item.codigo));
    }
  }

  return res.status(201).json({ id: venta.id, total: totalVenta, ganancia: totalGanancia, origen: "camioneta" });
});

router.post("/caducado", async (req, res) => {
  const { productoCodigo, cantidad, origen, vendedor } = req.body as {
    productoCodigo: string; cantidad: number; origen: "panaderia" | "camioneta"; vendedor?: string
  };
  if (!productoCodigo || !cantidad || cantidad <= 0)
    return res.status(400).json({ error: "Datos inválidos" });

  const [producto] = await db.select().from(productosTable).where(eq(productosTable.codigo, productoCodigo));
  if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

  const v = vendedor?.toLowerCase();
  let stockDisponible = producto.stock;
  if (origen === "camioneta") {
    stockDisponible = validarVendedor(v) ? (v === "michel" ? producto.stockCamionetaMichel : producto.stockCamionetaDavid) : 0;
  }

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
    registradoPor: vendedor || "Sistema",
  });

  if (origen === "camioneta" && validarVendedor(v)) {
    if (v === "michel") {
      await db.update(productosTable).set({ stockCamionetaMichel: sql`${productosTable.stockCamionetaMichel} - ${cantidad}`, actualizadoEn: new Date() }).where(eq(productosTable.codigo, productoCodigo));
    } else {
      await db.update(productosTable).set({ stockCamionetaDavid: sql`${productosTable.stockCamionetaDavid} - ${cantidad}`, actualizadoEn: new Date() }).where(eq(productosTable.codigo, productoCodigo));
    }
  } else {
    await db.update(productosTable).set({ stock: sql`${productosTable.stock} - ${cantidad}`, actualizadoEn: new Date() }).where(eq(productosTable.codigo, productoCodigo));
  }

  return res.json({ mensaje: "Pérdida registrada", costoTotal });
});

export default router;
