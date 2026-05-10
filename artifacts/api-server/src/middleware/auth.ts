import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const s = req.session as any;
  if (!s?.userId) return res.status(401).json({ error: "No autenticado" });
  next();
}
