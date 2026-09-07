import type { Request, Response, NextFunction } from "express";

export type AuthenticatedSession = {
  userId?: number;
  username?: string;
  nombre?: string;
  rol?: string;
  camionetaCodigo?: string;
};

function getAuthenticatedSession(req: Request): AuthenticatedSession {
  return req.session as unknown as AuthenticatedSession;
}

function normalizeCamionetaCodigo(value: string): string {
  return value.trim().toLowerCase();
}

function requestedCamionetaCodigo(req: Request): string | undefined {
  const vendedor = req.body?.vendedor;
  return typeof vendedor === "string" && vendedor.trim()
    ? normalizeCamionetaCodigo(vendedor)
    : undefined;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = getAuthenticatedSession(req);
  if (!session.userId || !session.username) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = getAuthenticatedSession(req);
  if (!session.userId || !session.username) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  if (session?.rol !== "admin") {
    res.status(403).json({ error: "Solo un administrador puede realizar esta acción" });
    return;
  }
  next();
}

export function requireAdminOrDavidForPrices(req: Request, res: Response, next: NextFunction) {
  const session = getAuthenticatedSession(req);
  if (!session.userId || !session.username) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const esDavid = session.username.trim().toLowerCase() === "david";
  if (session.rol !== "admin" && !esDavid) {
    res.status(403).json({ error: "Solo el administrador o David pueden actualizar precios" });
    return;
  }

  next();
}

/**
 * Authorizes an operation against a delivery vehicle.
 *
 * The vehicle submitted by the browser is only checked for consistency. For
 * sellers, the effective vehicle always comes from the authenticated session,
 * so changing `vendedor` in a direct request cannot redirect the operation to
 * another vehicle. Administrators have an explicit cross-vehicle permission.
 */
export function requireCamionetaAccess(req: Request, res: Response, next: NextFunction) {
  const session = getAuthenticatedSession(req);
  if (!session.userId || !session.username) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  if (session.rol === "admin") {
    next();
    return;
  }

  const authorizedCodigo = session.camionetaCodigo
    ? normalizeCamionetaCodigo(session.camionetaCodigo)
    : normalizeCamionetaCodigo(session.username);
  const requestedCodigo = requestedCamionetaCodigo(req);

  if (!authorizedCodigo || (requestedCodigo && requestedCodigo !== authorizedCodigo)) {
    res.status(403).json({ error: "No tenés permiso para operar esta camioneta" });
    return;
  }

  next();
}

/**
 * Returns the server-authorized vehicle code for a truck operation.
 * Sellers never get this value from the request body.
 */
export function getCamionetaCodigoAutorizado(req: Request): string | null {
  const session = getAuthenticatedSession(req);
  if (session.rol === "admin") {
    return requestedCamionetaCodigo(req) ?? null;
  }

  const codigo = session.camionetaCodigo ?? session.username;
  return codigo ? normalizeCamionetaCodigo(codigo) : null;
}
