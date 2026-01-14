import type { FastifyRequest } from "fastify";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { supabaseAdmin } from "./supabase.js";

const env = z
  .object({
    SUPABASE_URL: z.string().url(),
    SUPABASE_JWT_SECRET: z.string().optional(),
  })
  .parse(process.env);

const jwks = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

export interface AuthUser {
  userId: string;
  email?: string;
}

export async function verifySupabaseAccessToken(
  token: string
): Promise<{ ok: true; userId: string } | { ok: false; reason: string; debug?: Record<string, unknown> }> {
  const issuer = `${env.SUPABASE_URL}/auth/v1`;
  const issuers = [issuer, `${issuer}/`];
  let alg: string | undefined;

  try {
    const header = decodeProtectedHeader(token);
    alg = typeof header.alg === "string" ? header.alg : undefined;
  } catch {
    return { ok: false, reason: "invalid_jwt_format" };
  }

  try {
    if (alg?.startsWith("HS")) {
      if (!env.SUPABASE_JWT_SECRET) {
        return { ok: false, reason: "missing_supabase_jwt_secret", debug: { alg } };
      }
      const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
      const { payload } = await jwtVerify(token, secret, { issuer: issuers, algorithms: [alg] });
      const userId = typeof payload.sub === "string" ? payload.sub : null;
      if (!userId) return { ok: false, reason: "missing_sub", debug: { alg } };
      return { ok: true, userId };
    }

    const allowedAsymmetricAlgs = new Set(["RS256", "ES256", "EdDSA"]);
    if (!alg || !allowedAsymmetricAlgs.has(alg)) {
      return { ok: false, reason: "alg_not_allowed", debug: { alg } };
    }

    const { payload } = await jwtVerify(token, jwks, { issuer: issuers, algorithms: [alg] });
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) return { ok: false, reason: "missing_sub", debug: { alg } };
    return { ok: true, userId };
  } catch (e) {
    const debug = {
      alg,
      name: e instanceof Error ? e.name : "unknown",
      message: e instanceof Error ? e.message : String(e),
    };
    return { ok: false, reason: "jwt_verify_failed", debug };
  }
}

export async function verifyPersevereToken(
  token: string,
  secret: string
): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: "persevere-api",
      audience: "persevere",
    });

    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) {
      return { ok: false, reason: "missing_sub" };
    }

    return { ok: true, userId };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "jwt_verify_failed" };
  }
}

export async function mintPersevereToken(userId: string, secret: string): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("persevere-api")
    .setAudience("persevere")
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey);
}

export async function requireAuth(request: FastifyRequest): Promise<AuthUser> {
  const auth = request.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

  if (!token) {
    throw new Error("missing_bearer");
  }

  const env = z
    .object({
      PERSEVERE_JWT_SECRET: z.string().min(16),
    })
    .parse(process.env);

  // Try Persevere token first
  const persevereResult = await verifyPersevereToken(token, env.PERSEVERE_JWT_SECRET);
  if (persevereResult.ok) {
    // Get user email from Supabase
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(persevereResult.userId);
    return {
      userId: persevereResult.userId,
      email: user.user?.email,
    };
  }

  // Fall back to Supabase token
  const supabaseResult = await verifySupabaseAccessToken(token);
  if (!supabaseResult.ok) {
    throw new Error(`authentication_failed: ${supabaseResult.reason}`);
  }

  const { data: user } = await supabaseAdmin.auth.admin.getUserById(supabaseResult.userId);
  return {
    userId: supabaseResult.userId,
    email: user.user?.email,
  };
}

