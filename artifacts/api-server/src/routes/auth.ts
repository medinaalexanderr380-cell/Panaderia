import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usuariosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedSession } from "../middleware/auth";

const router = Router();

router.post("/auto-login", async (req, res) => {
  const usuarios = await db.select().from(usuariosTable);
  const usuario = usuarios.find((u) => u.activo && u.rol !== "admin");

  if (!usuario) {
    return res.status(503).json({ error: "No hay un usuario vendedor activo disponible" });
  }

  const session = req.session as unknown as AuthenticatedSession;
  session.userId = usuario.id;
  session.username = usuario.username;
  session.nombre = usuario.nombre;
  session.rol = usuario.rol;
  session.camionetaCodigo = usuario.username.trim().toLowerCase();

  return res.json({ id: usuario.id, username: usuario.username, nombre: usuario.nombre, rol: usuario.rol });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Usuario y contraseña requeridos" });

  const [usuario] = await db.select().from(usuariosTable).where(eq(usuariosTable.username, username));
  if (!usuario || !usuario.activo) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

  const ok = await bcrypt.compare(password, usuario.passwordHash);
  if (!ok) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

  const session = req.session as unknown as AuthenticatedSession;
  session.userId = usuario.id;
  session.username = usuario.username;
  session.nombre = usuario.nombre;
  session.rol = usuario.rol;
  session.camionetaCodigo = usuario.rol === "admin" ? undefined : usuario.username.trim().toLowerCase();

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

router.post("/verify-admin-password", async (req, res) => {
  const session = req.session as unknown as AuthenticatedSession;
  if (!session.userId || !session.username) {
    return res.status(401).json({ error: "No autenticado" });
  }

  const { password } = req.body;
  if (typeof password !== "string" || !password) {
    return res.status(400).json({ error: "Contraseña requerida" });
  }

  const usuarios = await db.select().from(usuariosTable);
  const administradores = usuarios.filter((usuario) => usuario.activo && usuario.rol === "admin");
  const verificaciones = await Promise.all(
    administradores.map((administrador) => bcrypt.compare(password, administrador.passwordHash)),
  );

  if (!verificaciones.some(Boolean)) {
    return res.status(401).json({ error: "Contraseña de administrador incorrecta" });
  }

  session.adminActionAuthorized = true;
  return res.json({ valido: true });
});

router.post("/verify", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Usuario y contraseña requeridos" });
  const [usuario] = await db.select().from(usuariosTable).where(eq(usuariosTable.username, username));
  if (!usuario || !usuario.activo) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  const ok = await bcrypt.compare(password, usuario.passwordHash);
  if (!ok) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  // This verification is used immediately before a truck operation. Store
  // the verified identity server-side; the following mutation must not trust
  // the vehicle name sent by the browser as its authorization source. An
  // existing administrator session already has cross-vehicle permission, so
  // verifying a driver's password must never downgrade that session.
  const session = req.session as unknown as AuthenticatedSession;
  if (session.userId && session.rol === "admin") {
    return res.json({ valido: true, nombre: usuario.nombre });
  }

  session.userId = usuario.id;
  session.username = usuario.username;
  session.nombre = usuario.nombre;
  session.rol = usuario.rol;
  session.camionetaCodigo = usuario.rol === "admin" ? undefined : usuario.username.trim().toLowerCase();

  return res.json({ valido: true, nombre: usuario.nombre });
});

export default router;
