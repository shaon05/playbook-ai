import dotenv from "dotenv";
import path from "node:path";
import { createApp } from "./app";
import { loadEnv } from "./config/env";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
const env = loadEnv();
const app = createApp({ env });

app.listen(env.PORT, env.HOST, () => {
  console.info(JSON.stringify({ event: "api_started", host: env.HOST, port: env.PORT, environment: env.NODE_ENV }));
});
