import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "./supabase.js";

export type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse,
  ctx: { userId: number; role: string; supabase: typeof supabaseAdmin },
) => Promise<void | VercelResponse>;

export function cors(handler: ApiHandler): ApiHandler {
  return async (req, res, ctx) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();
    return handler(req, res, ctx);
  };
}

export async function authenticate(
  req: VercelRequest,
): Promise<{ userId: number; role: string } | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const phone = data.user.phone ?? data.user.email ?? "";

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("auth_id", data.user.id)
    .single();

  if (!user) {
    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("id, provider_id")
      .eq("auth_id", data.user.id)
      .single();
    if (staff) return { userId: staff.id, role: "staff" };
    return null;
  }

  return { userId: user.id, role: user.role };
}

export async function requireAuth(
  req: VercelRequest,
): Promise<{ userId: number; role: string }> {
  const auth = await authenticate(req);
  if (!auth) throw new ApiError("Not authenticated", 401);
  return auth;
}

export async function requireRole(
  req: VercelRequest,
  ...roles: string[]
): Promise<{ userId: number; role: string }> {
  const auth = await requireAuth(req);
  if (!roles.includes(auth.role)) throw new ApiError("Forbidden", 403);
  return auth;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function handleError(res: VercelResponse, err: unknown) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ detail: err.message });
  }
  console.error("Unhandled error:", err);
  return res.status(500).json({ detail: "Internal server error" });
}
