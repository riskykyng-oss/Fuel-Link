import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SERVICES } from "../_lib/services.js";
import { handleError } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    return res.status(200).json(SERVICES);
  } catch (err) {
    return handleError(res, err);
  }
}
