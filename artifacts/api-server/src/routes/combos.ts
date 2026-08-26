import { Router } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, comboItemsTable, combosTable, productosTable } from "@workspace/db";
import { CrearComboBody, EliminarComboParams, EliminarComboResponse } from "@workspace/api-zod";

const router = Router();

type ComboRow = {
  id: number;
  nombre: string;
  descripcion: string;
  precioVenta: string | number;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
  productoCodigo: string | null;
  productoNombre: string | null;
  cantidad: number | null;
  precioUnitario: string | number | null;
};

function agruparCombos(rows: ComboRow[]) {
  const combos = new Map<number, {
    id: number;
    nombre: string;
    descripcion: string;
    precioVenta: number;
    activo: boolean;
    creadoEn: string;
    actualizadoEn: string;
    items: Array<{
      productoCodigo: string;
      productoNombre: string;
      cantidad: number;
      precioUnitario: number;
    }>;
  }>();

  for (const row of rows) {
    let combo = combos.get(row.id);
    if (!combo) {
      combo = {
        id: row.id,
        nombre: row.nombre,
        descripcion: row.descripcion,
        precioVenta: Number(row.precioVenta),
        activo: row.activo,
        creadoEn: row.creadoEn.toISOString(),
        actualizadoEn: row.actualizadoEn.toISOString(),
        items: [],
      };
      combos.set(row.id, combo);
    }

    if (row.productoCodigo && row.productoNombre && row.cantidad !== null && row.precioUnitario !== null) {
      combo.items.push({
        productoCodigo: row.productoCodigo,
        productoNombre: row.productoNombre,
        cantidad: row.cantidad,
        precioUnitario: Number(row.precioUnitario),
      });
    }
  }

  return Array.from(combos.values());
}

async function consultarCombos(where?: ReturnType<typeof eq>) {
  const rows = await db
    .select({
      id: combosTable.id,
      nombre: combosTable.nombre,
      descripcion: combosTable.descripcion,
      precioVenta: combosTable.precioVenta,
      activo: combosTable.activo,
      creadoEn: combosTable.creadoEn,
      actualizadoEn: combosTable.actualizadoEn,
      productoCodigo: comboItemsTable.productoCodigo,
      productoNombre: productosTable.nombre,
      cantidad: comboItemsTable.cantidad,
      precioUnitario: productosTable.precioVenta,
    })
    .from(combosTable)
    .leftJoin(comboItemsTable, eq(combosTable.id, comboItemsTable.comboId))
    .leftJoin(productosTable, eq(comboItemsTable.productoCodigo, productosTable.codigo))
    .where(where)
    .orderBy(combosTable.nombre);

  return agruparCombos(rows);
}

router.get("/", async (_req, res): Promise<void> => {
  const combos = await consultarCombos();
  res.json(combos);
});

router.post("/", async (req, res): Promise<void> => {
  const parsed = CrearComboBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const productCodes = parsed.data.items.map(item => item.productoCodigo);
  if (new Set(productCodes).size !== productCodes.length) {
    res.status(400).json({ error: "No se puede repetir un producto dentro del combo" });
    return;
  }

  const productos = await db
    .select({ codigo: productosTable.codigo })
    .from(productosTable)
    .where(inArray(productosTable.codigo, productCodes));

  if (productos.length !== productCodes.length) {
    res.status(400).json({ error: "Uno o más productos seleccionados no existen" });
    return;
  }

  const combo = await db.transaction(async (tx) => {
    const [created] = await tx.insert(combosTable).values({
      nombre: parsed.data.nombre.trim(),
      descripcion: parsed.data.descripcion?.trim() ?? "",
      precioVenta: String(parsed.data.precioVenta),
    }).returning();

    await tx.insert(comboItemsTable).values(
      parsed.data.items.map(item => ({
        comboId: created.id,
        productoCodigo: item.productoCodigo,
        cantidad: item.cantidad,
      })),
    );

    return created;
  });

  const [createdCombo] = await consultarCombos(eq(combosTable.id, combo.id));
  res.status(201).json(createdCombo);
});

router.delete("/:id", async (req, res): Promise<void> => {
  const parsed = EliminarComboParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [combo] = await db
    .select({ id: combosTable.id })
    .from(combosTable)
    .where(eq(combosTable.id, parsed.data.id));

  if (!combo) {
    res.status(404).json({ error: "Combo no encontrado" });
    return;
  }

  await db.delete(combosTable).where(eq(combosTable.id, combo.id));
  res.json(EliminarComboResponse.parse({ mensaje: "Combo eliminado" }));
});

export default router;