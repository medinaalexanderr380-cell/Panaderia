import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedAdminIfEmpty } from "./lib/seed-admin";

const app: Express = express();

// Replit termina HTTPS en su proxy. Express necesita confiar en ese proxy para
// poder emitir correctamente las cookies de sesión marcadas como Secure.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env["SESSION_SECRET"] || "panaderia-secret-fallback";
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7,
    sameSite: process.env["NODE_ENV"] === "production" ? "none" : "lax",
  },
}));

seedAdminIfEmpty().catch(err => logger.error({ err }, "Error seeding admin"));

app.use("/api", router);

// En producción externa, Express sirve el frontend estático
if (process.env["NODE_ENV"] === "production" && !process.env["REPL_ID"]) {
  const workspaceRoot = process.cwd().endsWith(
    path.join("artifacts", "api-server")
  )
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();

  const staticDir = path.resolve(workspaceRoot, "artifacts/panaderia/dist/public");

  app.use(express.static(staticDir));

  // SPA fallback — cualquier ruta que no sea /api sirve index.html
  app.use((_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
