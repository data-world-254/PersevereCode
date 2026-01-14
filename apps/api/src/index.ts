import "dotenv/config";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";
import { verifySupabaseAccessToken, mintPersevereToken } from "./lib/auth.js";
import { jobsRoutes } from "./routes/jobs.js";
import { projectsRoutes } from "./routes/projects.js";
import { webhookRoutes } from "./routes/webhooks.js";

const env = z
  .object({
    PORT: z.string().default("8080"),
    SUPABASE_URL: z.string().url(),
    SUPABASE_JWT_SECRET: z.string().optional(),
    PERSEVERE_JWT_SECRET: z.string().min(16),
    WEB_APP_BASE_URL: z.string().url(),
    ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
    API_BASE_URL: z.string().url().optional(),
  })
  .parse(process.env);

type DeviceNote = {
  deviceCode: string;
  userCode: string;
  expiresAt: number;
  status: "pending" | "authorized";
  userId?: string;
};

const deviceByDeviceCode = new Map<string, DeviceNote>();
const deviceByUserCode = new Map<string, DeviceNote>();


function randomUserCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const note of deviceByDeviceCode.values()) {
    if (note.expiresAt <= now) {
      deviceByDeviceCode.delete(note.deviceCode);
      deviceByUserCode.delete(note.userCode);
    }
  }
}

setInterval(cleanupExpired, 30_000).unref();

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.ALLOWED_ORIGINS.split(",").map((s: string) => s.trim()),
  credentials: true,
});

await app.register(websocket);

// Health check
app.get("/health", async () => ({ ok: true }));

// Register job routes
await app.register(async (fastify) => {
  await jobsRoutes(fastify);
});

// Register project routes
await app.register(async (fastify) => {
  await projectsRoutes(fastify);
});

// Register webhook routes
await app.register(async (fastify) => {
  await webhookRoutes(fastify);
});

app.post("/auth/device/start", async () => {
  const deviceCode = crypto.randomUUID();
  let userCode = randomUserCode();
  while (deviceByUserCode.has(userCode)) userCode = randomUserCode();

  const expiresAt = Date.now() + 15 * 60 * 1000;

  const note: DeviceNote = {
    deviceCode,
    userCode,
    expiresAt,
    status: "pending",
  };

  deviceByDeviceCode.set(deviceCode, note);
  deviceByUserCode.set(userCode, note);

  const verificationUrl = `${env.WEB_APP_BASE_URL}/device?code=${encodeURIComponent(userCode)}`;

  return {
    device_code: deviceCode,
    user_code: userCode,
    verification_url: verificationUrl,
    expires_in: 900,
    interval: 2,
  };
});

app.post("/auth/device/complete", async (req: FastifyRequest, reply: FastifyReply) => {
  const schema = z.object({ user_code: z.string().min(1) });
  const body = schema.parse(req.body);

  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) return reply.code(401).send({ error: "missing_bearer" });

  const verified = await verifySupabaseAccessToken(token);
  if (!verified.ok) {
    const dev = process.env.NODE_ENV !== "production";
    return reply
      .code(401)
      .send({ error: "invalid_supabase_token", ...(dev ? { details: verified } : {}) });
  }

  const note = deviceByUserCode.get(body.user_code);
  if (!note) return reply.code(404).send({ error: "invalid_code" });
  if (note.expiresAt <= Date.now()) return reply.code(410).send({ error: "expired" });

  note.status = "authorized";
  note.userId = verified.userId;

  return { ok: true };
});

app.post("/auth/device/token", async (req: FastifyRequest, reply: FastifyReply) => {
  const schema = z.object({ device_code: z.string().min(1) });
  const body = schema.parse(req.body);

  const note = deviceByDeviceCode.get(body.device_code);
  if (!note) return reply.code(404).send({ error: "invalid_device_code" });
  if (note.expiresAt <= Date.now()) return reply.code(410).send({ error: "expired" });
  if (note.status !== "authorized" || !note.userId) return reply.code(428).send({ error: "authorization_pending" });

  const accessToken = await mintPersevereToken(note.userId, env.PERSEVERE_JWT_SECRET);

  deviceByDeviceCode.delete(note.deviceCode);
  deviceByUserCode.delete(note.userCode);

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 30 * 24 * 60 * 60,
  };
});

await app.listen({ port: Number(env.PORT), host: "0.0.0.0" });
