import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usuariosTable } from "@workspace/db";
import { logger } from "./logger";

export async function seedAdminIfEmpty() {
  const existing = await db.select().from(usuariosTable).limit(1);
  if (existing.length > 0) return;

  const defaultPassword = process.env["ADMIN_PASSWORD"] || "panaderia123";
  const hash = await bcrypt.hash(defaultPassword, 10);

  await db.insert(usuariosTable).values({
    username: "admin",
    nombre: "Administrador",
    passwordHash: hash,
    rol: "admin",
    activo: true,
  });

  logger.info("Usuario admin creado con contraseña por defecto");
}
