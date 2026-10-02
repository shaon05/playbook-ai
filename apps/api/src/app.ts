import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiEnv } from "./config/env";
import { errorHandler, notFound } from "./middleware/error.middleware";
import { requestLogger } from "./middleware/request-logger";
import { healthRouter } from "./modules/health/health.routes";
import { createMeRouter } from "./modules/users/me.routes";
import { createBooksRouter } from "./modules/books/books.routes";
import { S3StorageProvider } from "./providers/storage/s3.storage.provider";
import type { StorageProvider } from "./providers/storage/storage.provider";

export type AppOptions = { env: ApiEnv; supabase?: SupabaseClient; storage?: StorageProvider };

export function createApp({ env, supabase, storage }: AppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((origin: string) => origin.trim()) }));
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
  app.use(requestLogger);

  const api = express.Router();
  api.use("/health", healthRouter);
  api.use("/me", createMeRouter(env, supabase ? () => supabase : undefined));
  api.use("/books", createBooksRouter(env, storage ?? new S3StorageProvider(env), supabase ? () => supabase : undefined));
  app.use("/api/v1", api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
