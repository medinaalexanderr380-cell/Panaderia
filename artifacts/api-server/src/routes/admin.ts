import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";

const router = Router();

router.post("/reiniciar", requireAdmin, async (req, res) => {
  await db.execute(
    sql`TRUNCATE TABLE items_venta, items_compra, ventas, compras, perdidas, gastos, productos, proveedores RESTART IDENTITY CASCADE`
  );
  return res.json({ mensaje: "Todos los datos fueron reiniciados correctamente" });
});

export default router;
