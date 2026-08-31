import { Router } from "express";
import { db } from "@workspace/db";
import { gastosTable } from "@workspace/db";
import { eq, gte, desc, sql } from "drizzle-orm";
import { insertGastoSchema } from "@workspace/db";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { desde, hasta } = req.query as Record<string, string>;
  let query = db.select().from(gastosTable).orderBy(desc(gastosTable.fecha));

  if (desde) {
    const rows = await db
      .select()
      .from(gastosTable)
      .where(gte(gastosTable.fecha, new Date(desde)))
      .orderBy(desc(gastosTable.fecha));
    return res.json(rows);
  }

  const rows = await query;
  return res.json(rows);
});

router.post("/", async (req, res) => {
  const parsed = insertGastoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const { descripcion, monto, fecha } = parsed.data;
  const [gasto] = await db.insert(gastosTable).values({
    descripcion,
    monto: String(monto),
    fecha: fecha ? new Date(fecha as unknown as string) : new Date(),
  }).returning();
  return res.status(201).json(gasto);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  await db.delete(gastosTable).where(eq(gastosTable.id, id));
  return res.json({ ok: true });
});

router.get("/por-dia", async (req, res) => {
  const rows = await db
    .select({
      fecha: sql<string>`DATE(${gastosTable.fecha})`,
      total: sql<number>`sum(${gastosTable.monto}::numeric)`,
      items: sql<number>`count(*)`,
    })
    .from(gastosTable)
    .where(gte(gastosTable.fecha, new Date(Date.now() - 30 * 86400000)))
    .groupBy(sql`DATE(${gastosTable.fecha})`)
    .orderBy(desc(sql`DATE(${gastosTable.fecha})`));
  return res.json(rows);
});

export default router;
