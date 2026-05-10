import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usuariosTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Usuario y contraseña requeridos" });

  const [usuario] = await db.select().from(usuariosTable).where(eq(usuariosTable.username, username));
  if (!usuario || !usuario.activo) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

  const ok = await bcrypt.compare(password, usuario.passwordHash);
  if (!ok) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

  (req.session as any).userId = usuario.id;
  (req.session as any).username = usuario.username;
  (req.session as any).nombre = usuario.nombre;
  (req.session as any).rol = usuario.rol;

  return res.json({ id: usuario.id, username: usuario.username, nombre: usuario.nombre, rol: usuario.rol });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ mensaje: "Sesión cerrada" });
  });
});

router.get("/me", (req, res) => {
  const s = req.session as any;
  if (!s?.userId) return res.status(401).json({ error: "No autenticado" });
  return res.json({ id: s.userId, username: s.username, nombre: s.nombre, rol: s.rol });
});

export default router;
