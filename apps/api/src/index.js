import express from "express";
import cors from "cors";
import { requireAuth } from "./auth.js";
import { listNodesSince, upsertNodes, getStats } from "./storage.js";

const app = express();
const port = Number.parseInt(process.env.PORT ?? "8787", 10);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/stats", requireAuth, (_req, res) => {
  res.json(getStats());
});

app.get("/sync/pull", requireAuth, (req, res) => {
  const workspaceId = String(req.query.workspaceId ?? "");
  const since = req.query.since ? String(req.query.since) : undefined;

  if (!workspaceId) {
    res.status(400).json({ message: "workspaceId is required" });
    return;
  }

  const nodes = listNodesSince(workspaceId, since);
  res.json({
    workspaceId,
    nodes,
    serverTime: new Date().toISOString()
  });
});

app.post("/sync/push", requireAuth, (req, res) => {
  const { workspaceId, changes } = req.body ?? {};

  if (!workspaceId || !Array.isArray(changes)) {
    res.status(400).json({ message: "workspaceId and changes are required" });
    return;
  }

  const result = upsertNodes(String(workspaceId), changes);
  res.json({
    workspaceId,
    ...result,
    serverTime: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`[rehilo-api] listening on http://localhost:${port}`);
});
