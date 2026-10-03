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
import { createHelpRouter } from "./modules/help/help.routes";
import { createSupportRouter } from "./modules/help/help.routes";
import { createCreatorRouter } from "./modules/creator/creator.routes";
import { createCatalogRouter } from "./modules/catalog/catalog.routes";
import { createListeningRouter } from "./modules/listening/listening.routes";
import { createMalwareScanner } from "./security/malware-scanner";
import { createDocumentsRouter } from "./modules/documents/documents.routes";

export type AppOptions = { env: ApiEnv; supabase?: SupabaseClient; storage?: StorageProvider };

export function createApp({ env, supabase, storage }: AppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((origin: string) => origin.trim()) }));
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
  app.use(requestLogger);

  const api = express.Router();
  const malwareScanner = createMalwareScanner(env);
  api.use("/health", healthRouter);
  api.use("/help", createHelpRouter(env));
  api.use("/support", createSupportRouter(env, supabase ? () => supabase : undefined));
  api.use("/creator", createCreatorRouter(env, supabase ? () => supabase : undefined, storage ?? new S3StorageProvider(env), malwareScanner));
  api.use("/catalog", createCatalogRouter(env));
  api.use("/search", createCatalogRouter(env));
  api.use("/listening", createListeningRouter(env, supabase ? () => supabase : undefined));
  api.use("/me", createMeRouter(env, supabase ? () => supabase : undefined));
  api.use("/books", createBooksRouter(env, storage ?? new S3StorageProvider(env), supabase ? () => supabase : undefined, malwareScanner));
  api.use("/documents", createDocumentsRouter(env, storage ?? new S3StorageProvider(env), supabase ? () => supabase : undefined, malwareScanner));
  app.use("/api/v1", api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
