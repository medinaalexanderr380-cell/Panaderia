import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usuariosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_USERS = [
  { username: "michel", nombre: "Michel", password: "0405", rol: "vendedor" },
  { username: "david", nombre: "David", password: "0910", rol: "vendedor" },
  { username: "admin", nombre: "Administrador", password: process.env["ADMIN_PASSWORD"] || "panaderia123", rol: "admin" },
];

export async function seedAdminIfEmpty() {
  for (const u of DEFAULT_USERS) {
    const existing = await db.select().from(usuariosTable).where(eq(usuariosTable.username, u.username));
    if (existing.length > 0) continue;
    const hash = await bcrypt.hash(u.password, 10);
    await db.insert(usuariosTable).values({
      username: u.username,
      nombre: u.nombre,
      passwordHash: hash,
      rol: u.rol,
      activo: true,
    });
    logger.info({ username: u.username }, "Usuario creado");
  }
}
