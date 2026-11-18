import "dotenv/config";
import express from "express";
import { createConnection } from "mysql2";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

async function checkDatabaseConnection() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("[DB Test] DATABASE_URL is missing");
    return;
  }

  let connection: ReturnType<typeof createConnection> | undefined;
  try {
    const url = new URL(connectionString);
    connection = createConnection({
      host: url.hostname,
      port: Number(url.port || 4000),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\//, "")),
      ssl: { minVersion: "TLSv1.2" },
      connectTimeout: 15000,
    });

    await new Promise<void>((resolve, reject) => {
      connection!.connect(error => error ? reject(error) : resolve());
    });

    await new Promise<void>((resolve, reject) => {
      connection!.query("SELECT 1 AS connected", error =>
        error ? reject(error) : resolve()
      );
    });

    console.log("[DB Test] TiDB connection successful; SELECT 1 passed");
  } catch (error) {
    const code = (error as { code?: string }).code || "UNKNOWN_ERROR";
    console.error("[DB Test] TiDB connection failed:", code);
  } finally {
    if (connection) connection.end();
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  await checkDatabaseConnection();

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

startServer().catch(error => { console.error(error); process.exit(1); });
