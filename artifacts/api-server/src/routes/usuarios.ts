import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usuariosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

function requireAdmin(req: any, res: any, next: any) {
  if ((req.session as any)?.rol !== "admin") return res.status(403).json({ error: "Solo el administrador puede realizar esta acción" });
  next();
}

router.get("/", requireAdmin, async (req, res) => {
  const usuarios = await db
    .select({
      id: usuariosTable.id,
      username: usuariosTable.username,
      nombre: usuariosTable.nombre,
      rol: usuariosTable.rol,
      activo: usuariosTable.activo,
      creadoEn: usuariosTable.creadoEn,
    })
    .from(usuariosTable)
    .orderBy(usuariosTable.nombre);
  return res.json(usuarios);
});

router.post("/", requireAdmin, async (req, res) => {
  const { username, nombre, password, rol } = req.body;
  if (!username || !nombre || !password) return res.status(400).json({ error: "Usuario, nombre y contraseña son requeridos" });

  const existing = await db.select().from(usuariosTable).where(eq(usuariosTable.username, username));
  if (existing.length > 0) return res.status(409).json({ error: "El nombre de usuario ya existe" });

  const passwordHash = await bcrypt.hash(password, 10);
  const [nuevo] = await db.insert(usuariosTable).values({
    username,
    nombre,
    passwordHash,
    rol: rol || "vendedor",
    activo: true,
  }).returning({ id: usuariosTable.id, username: usuariosTable.username, nombre: usuariosTable.nombre, rol: usuariosTable.rol, activo: usuariosTable.activo });

  return res.status(201).json(nuevo);
});

router.put("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params["id"]);
  const { nombre, rol, activo } = req.body;
  if (!nombre) return res.status(400).json({ error: "El nombre es requerido" });

  const [updated] = await db.update(usuariosTable)
    .set({ nombre, rol: rol || "vendedor", activo: activo !== undefined ? activo : true })
    .where(eq(usuariosTable.id, id))
    .returning({ id: usuariosTable.id, username: usuariosTable.username, nombre: usuariosTable.nombre, rol: usuariosTable.rol, activo: usuariosTable.activo });

  if (!updated) return res.status(404).json({ error: "Usuario no encontrado" });
  return res.json(updated);
});

router.put("/:id/password", requireAdmin, async (req, res) => {
  const id = Number(req.params["id"]);
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });

  const passwordHash = await bcrypt.hash(password, 10);
  const [updated] = await db.update(usuariosTable)
    .set({ passwordHash })
    .where(eq(usuariosTable.id, id))
    .returning({ id: usuariosTable.id });

  if (!updated) return res.status(404).json({ error: "Usuario no encontrado" });
  return res.json({ mensaje: "Contraseña actualizada" });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params["id"]);
  const sessionId = (req.session as any)?.userId;
  if (id === sessionId) return res.status(400).json({ error: "No podés desactivar tu propio usuario" });

  const [updated] = await db.update(usuariosTable)
    .set({ activo: false })
    .where(eq(usuariosTable.id, id))
    .returning({ id: usuariosTable.id });

  if (!updated) return res.status(404).json({ error: "Usuario no encontrado" });
  return res.json({ mensaje: "Usuario desactivado" });
});

export default router;
