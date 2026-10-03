import { Router } from "express";
import { verifyImageProcessingCapabilities } from "../../security/image-capabilities";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({ data: { status: "ok", service: "playbook-api", imageProcessing: verifyImageProcessingCapabilities() } });
});
