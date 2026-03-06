import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { auth } from "./auth";
import { env } from "./env";
import { prisma } from "./prisma";
import { bootstrapInitialAdmin } from "./seed";
import { vehiclesRouter } from "./routes/vehicles";
import { customersRouter } from "./routes/customers";
import { salesRouter } from "./routes/sales";
import { documentsRouter } from "./routes/documents";
import { brandsRouter } from "./routes/brands";
import { colorsRouter } from "./routes/colors";
import { suppliersRouter } from "./routes/suppliers";
import { connectorTypesRouter } from "./routes/connectorTypes";
import { suppliersDbRouter } from "./routes/suppliersDb";
import { financesRouter } from "./routes/finances";

type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

const app = new Hono<{ Variables: Variables }>();

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wildcardOriginToRegex(origin: string): RegExp {
  const escaped = escapeRegex(origin).replace(/\\\*/g, "[^.]+?");
  return new RegExp(`^${escaped}$`, "i");
}

function parseAllowedOrigins(raw: string | undefined): {
  exact: Set<string>;
  patterns: RegExp[];
} {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];
  const backendOrigin = new URL(env.BACKEND_URL).origin;

  const defaults = ["http://localhost:8000", "http://127.0.0.1:8000", backendOrigin];

  for (const origin of defaults) {
    exact.add(origin);
  }

  for (const origin of (raw ?? "").split(",").map((v) => v.trim()).filter(Boolean)) {
    if (origin.includes("*")) {
      patterns.push(wildcardOriginToRegex(origin));
    } else {
      exact.add(origin);
    }
  }

  return { exact, patterns };
}

const allowedOrigins = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) {
        return null;
      }

      if (allowedOrigins.exact.has(origin)) {
        return origin;
      }

      if (allowedOrigins.patterns.some((pattern) => pattern.test(origin))) {
        return origin;
      }

      return null;
    },
    credentials: true,
  })
);

app.use("*", logger());

app.get("/health", async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({
      status: "ok",
      database: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[health] database_check_failed", error);
    return c.json(
      {
        status: "degraded",
        database: "error",
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
});

app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

app.options("/api/auth/**", (c) => c.text("", 204));

app.use("/api/*", async (c, next) => {
  if (c.req.path.startsWith("/api/auth")) {
    return next();
  }

  if (c.req.method === "OPTIONS") {
    return c.text("", 204);
  }

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user || !session?.session) {
    console.warn(`[auth] unauthorized path=${c.req.path}`);
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        },
      },
      401
    );
  }

  c.set("user", session.user);
  c.set("session", session.session);

  return next();
});

app.use(
  "/api/uploads/*",
  serveStatic({
    root: "./uploads",
    rewriteRequestPath: (path) => path.replace(/^\/api\/uploads/, ""),
  })
);

app.route("/api/vehicles", vehiclesRouter);
app.route("/api/customers", customersRouter);
app.route("/api/sales", salesRouter);
app.route("/api/documents", documentsRouter);
app.route("/api/brands", brandsRouter);
app.route("/api/colors", colorsRouter);
app.route("/api/suppliers", suppliersRouter);
app.route("/api/connector-types", connectorTypesRouter);
app.route("/api/suppliers-db", suppliersDbRouter);
app.route("/api/finances", financesRouter);

const port = Number(env.PORT) || 3000;

bootstrapInitialAdmin().catch((error) => {
  console.error("[bootstrap] initial_admin_failed", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[runtime] unhandled_rejection", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[runtime] uncaught_exception", error);
});

console.info(`[startup] backend_ready port=${port} env=${env.NODE_ENV}`);

export default {
  port,
  fetch: app.fetch,
};
