import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { auth } from "./auth";
import { env } from "./env";
import { prisma } from "./prisma";
import { bootstrapInitialAdmin } from "./seed";
import {
  ensureCoreSaasData,
  getMembershipEntitlements,
  getTenantStatus as deriveTenantStatus,
  normalizeHost,
  pickActiveMembership,
  type ActiveDealerMembership,
} from "./lib/dealers";
import { getBillingState, getCurrentSubscription } from "./lib/billing";
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
import { sessionRouter } from "./routes/session";
import { settingsRouter } from "./routes/settings";
import { adminRouter } from "./routes/admin";
import { publicRouter } from "./routes/public";
import { billingRouter } from "./routes/billing";

type Variables = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    username?: string | null;
    platformRole?: string | null;
  } | null;
  session: typeof auth.$Infer.Session.session | null;
  membership: ActiveDealerMembership | null;
  entitlements: Record<string, boolean>;
  resolvedHost: string | null;
  resolvedDealer:
    | (ActiveDealerMembership["dealer"] & {
        createdAt: Date;
        updatedAt: Date;
      })
    | null;
  resolvedDomain: null;
  tenantStatus: "unknown" | "pending_setup" | "active" | "suspended" | "inactive";
  billing: {
    status: "active" | "trialing" | "past_due" | "suspended" | "canceled" | "none";
    trialEndsAt: Date | null;
    currentPeriodEndsAt: Date | null;
    requiresPayment: boolean;
    canAccessApp: boolean;
  };
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

app.use("*", async (c, next) => {
  const host = normalizeHost(c.req.header("host"));
  c.set("resolvedHost", host || null);
  c.set("resolvedDealer", null);
  c.set("resolvedDomain", null);
  c.set("tenantStatus", "unknown");

  return next();
});

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

// Hono uses `*` to match the full remaining auth subpath.
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

app.options("/api/auth/*", (c) => c.text("", 204));

app.use("/api/*", async (c, next) => {
  if (
    c.req.path.startsWith("/api/auth") ||
    c.req.path.startsWith("/api/public") ||
    c.req.path === "/api/billing/webhook"
  ) {
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

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      memberships: {
        where: {
          isActive: true,
          dealer: {
            is: {
              status: {
                in: ["active", "suspended"],
              },
            },
          },
        },
        include: {
          dealer: {
            include: {
              settings: true,
              subscriptions: {
                include: { plan: true },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  const resolvedDealer = c.get("resolvedDealer");
  const memberships = (dbUser?.memberships ?? []) as ActiveDealerMembership[];
  const activeMembership = pickActiveMembership(memberships);
  const entitlements = getMembershipEntitlements(activeMembership);
  const effectiveDealer = activeMembership?.dealer ?? null;
  const billing = getBillingState(getCurrentSubscription(activeMembership?.dealer.subscriptions));

  if (!activeMembership && dbUser?.platformRole !== "platform_super_admin") {
    return c.json(
      {
        error: {
          code: "NO_ACTIVE_DEALER",
          message: "No active dealer membership found",
        },
      },
      403
    );
  }

  c.set("user", {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    username: session.user.username,
    platformRole: dbUser?.platformRole ?? "user",
  });
  c.set("session", session.session);
  c.set("membership", activeMembership as Variables["membership"]);
  c.set("entitlements", entitlements);
  c.set("billing", billing);

  if (effectiveDealer) {
    c.set("resolvedDealer", effectiveDealer as Variables["resolvedDealer"]);
    c.set(
      "tenantStatus",
      deriveTenantStatus({
        dealerStatus: effectiveDealer.status,
        setupStatus: effectiveDealer.setupStatus,
      })
    );
  }

  if (dbUser?.platformRole === "platform_super_admin" && c.req.path.startsWith("/api/admin")) {
    return next();
  }

  const tenantStatus = c.get("tenantStatus");
  const path = c.req.path;
  const allowWithoutTenant = path.startsWith("/api/session") || path.startsWith("/api/billing");

  if (!effectiveDealer && !allowWithoutTenant) {
    return c.json(
      {
        error: {
          code: "UNKNOWN_TENANT",
          message: "Kein aktives Autohaus gefunden",
        },
      },
      404
    );
  }

  if (tenantStatus === "suspended" || tenantStatus === "inactive") {
    if (!allowWithoutTenant) {
      return c.json(
        {
          error: {
            code: "TENANT_UNAVAILABLE",
            message: "Dieser Mandant ist derzeit nicht verfuegbar",
          },
        },
        403
      );
    }
  }

  if (tenantStatus === "pending_setup") {
    const allowedPrefixes = ["/api/session", "/api/settings", "/api/billing"];
    if (!allowedPrefixes.some((prefix) => path.startsWith(prefix))) {
      return c.json(
        {
          error: {
            code: "TENANT_SETUP_INCOMPLETE",
            message: "Dieser Mandant befindet sich noch im Onboarding",
          },
        },
        403
      );
    }
  }

  if (billing.requiresPayment) {
    const allowedPrefixes = ["/api/session", "/api/billing"];
    if (!allowedPrefixes.some((prefix) => path.startsWith(prefix))) {
      return c.json(
        {
          error: {
            code: "PAYMENT_REQUIRED",
            message: "Dein Testzeitraum ist abgelaufen oder dein Abo ist nicht aktiv.",
          },
        },
        402
      );
    }
  }

  return next();
});

app.use(
  "/api/uploads/*",
  async (c, next) => {
    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type");
    c.header("Cross-Origin-Resource-Policy", "cross-origin");

    if (c.req.method === "OPTIONS") {
      return c.text("", 204);
    }

    return next();
  }
);

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
app.route("/api/public", publicRouter);
app.route("/api/session", sessionRouter);
app.route("/api/billing", billingRouter);
app.route("/api/settings", settingsRouter);
app.route("/api/admin", adminRouter);

const port = Number(env.PORT) || 3000;

ensureCoreSaasData().catch((error) => {
  console.error("[bootstrap] core_saas_data_failed", error);
});

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
