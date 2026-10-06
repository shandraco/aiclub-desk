import { z } from "zod";

/**
 * Server environment, validated once. Importing this module parses `process.env`; a bad
 * value throws with every problem listed, so a misconfigured deploy fails at build or at
 * server start (see instrumentation.ts) instead of on the first request that needs it.
 *
 * Add a variable here, in `.env.example`, and in the Vercel project settings, in that order.
 * Never put secrets in `NEXT_PUBLIC_*`: those are inlined into the browser bundle at build.
 */
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // Vercel sets these; locally they are absent.
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),

    /** Canonical origin, no trailing slash: https://example.com. Used for canonicals, sitemap, OG. */
    SITE_URL: z.url().optional(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    /** Where browsers POST CSP violation reports. Optional. */
    CSP_REPORT_URI: z.url().optional(),


    /** Postgres. Neon's pooled URL on Vercel (set by the Neon integration); local Postgres in dev. */
    DATABASE_URL: z.string().min(1).optional(),
    /** Vercel Blob store token (set when the store is connected). Without it, uploads are off. */
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.VERCEL_ENV === "production" && !env.DATABASE_URL) {
      ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "is required in production (connect Neon in Vercel)" });
    }
    if (env.NODE_ENV === "production" && !env.SITE_URL && !env.VERCEL_PROJECT_PRODUCTION_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["SITE_URL"],
        message: "is required for a production build (copy .env.example to .env.local)",
      });
    }
  })
  .transform((env) => ({
    ...env,
    SITE_URL: (
      env.SITE_URL ??
      (env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000")
    ).replace(/\/$/, ""),
  }));

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join(".") || "(root)"} ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join("\n")}`);
  }
  return result.data;
}

export const env: Env = parseEnv(process.env);
