import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = req.session as unknown as { rol?: string };
  if (session?.rol !== "admin") {
    res.status(403).json({ error: "Solo un administrador puede gestionar camionetas" });
    return;
  }
  next();
}
