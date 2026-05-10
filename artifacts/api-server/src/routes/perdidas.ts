import { Router } from "express";
import { db } from "@workspace/db";
import { perdidasTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const perdidas = await db
    .select()
    .from(perdidasTable)
    .orderBy(desc(perdidasTable.fecha));

  return res.json(perdidas.map(p => ({
    ...p,
    costoTotal: Number(p.costoTotal),
    fecha: p.fecha.toISOString(),
  })));
});

export default router;
