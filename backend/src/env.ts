import { z } from "zod";

/**
 * Environment variable schema using Zod
 * This ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  // Server Configuration
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development"),

  // Database
  DATABASE_URL: z.string().min(1),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(1),
  BACKEND_URL: z.string().url(),
  PUBLIC_APP_URL: z.string().url().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  PLATFORM_DOMAIN: z
    .string()
    .optional()
    .default("carops.de")
    .transform((value) => value.trim().replace(/^\.+/, "").toLowerCase()),
  PLATFORM_SUPPORT_EMAIL: z.string().email().optional().default("support@carops.de"),
  AUTH_DISABLE_CSRF_CHECK: z
    .string()
    .optional()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),
  BOOTSTRAP_ADMIN: z
    .string()
    .optional()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),
  INITIAL_ADMIN_NAME: z.string().optional(),
  INITIAL_ADMIN_USERNAME: z.string().optional(),
  INITIAL_ADMIN_PASSWORD: z.string().optional(),
  INITIAL_ADMIN_EMAIL: z.string().email().optional(),
  SUPERADMIN_NAME: z.string().optional(),
  SUPERADMIN_USERNAME: z.string().optional(),
  SUPERADMIN_PASSWORD: z.string().optional(),
  SUPERADMIN_EMAIL: z.string().email().optional(),

  // Comma-separated list of allowed origins, supports wildcard prefix via https://*.example.com
  CORS_ALLOWED_ORIGINS: z.string().optional(),

  // AI extraction
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z
    .string()
    .optional()
    .default("gpt-4o-mini")
    .transform((value) => value.trim() || "gpt-4o-mini"),
  OPENAI_EXTRACTION_MODEL: z
    .string()
    .optional()
    .default("gpt-4o")
    .transform((value) => value.trim() || "gpt-4o"),

  // Billing
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_STANDARD_PRICE_ID: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
});

/**
 * Validate and parse environment variables
 */
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env);
    console.log("✅ Environment variables validated successfully");
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment variable validation failed:");
      error.issues.forEach((err: any) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validated and typed environment variables
 */
export const env = validateEnv();

/**
 * Type of the validated environment variables
 */
export type Env = z.infer<typeof envSchema>;
