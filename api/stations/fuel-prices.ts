import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase.js";
import { handleError } from "../_lib/auth.js";

const ZERA_URL = "https://www.zera.co.zw/fuel-pricing/";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const COLD_PETROL = 1.57;
const COLD_DIESEL = 1.54;

const PRICE_RE = /(blend|petrol|unleaded|diesel)[^0-9$]{0,80}\$?\s*([0-9]\.[0-9]{2,4})/gi;

function parse(html: string): { petrol: number; diesel: number } | null {
  let petrol: number | null = null;
  let diesel: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = PRICE_RE.exec(html))) {
    const price = parseFloat(m[2]);
    if (price < 0.30 || price > 5.00) continue;
    if (m[1].toLowerCase() === "diesel" && diesel === null) diesel = price;
    else if (m[1].toLowerCase() !== "diesel" && petrol === null) petrol = price;
  }
  if (petrol === null || diesel === null) return null;
  return { petrol, diesel };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const force = req.query.refresh === "true";
    const { data: cached } = await supabaseAdmin
      .from("price_snapshots")
      .select("*")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached && !force) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_TTL_MS && cached.is_live) {
        return res.status(200).json(cached);
      }
    }

    let parsed: { petrol: number; diesel: number } | null = null;
    try {
      const resp = await fetch(ZERA_URL, {
        headers: { "User-Agent": "FuelLink/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      const html = await resp.text();
      parsed = parse(html);
    } catch { /* network error */ }

    if (parsed) {
      const { data } = await supabaseAdmin
        .from("price_snapshots")
        .insert({
          petrol_price: parsed.petrol,
          diesel_price: parsed.diesel,
          source: "ZERA fuel pricing page",
          source_url: ZERA_URL,
          is_live: true,
          effective_period: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
        })
        .select()
        .single();
      return res.status(200).json(data);
    }

    if (cached) return res.status(200).json(cached);

    const { data: fallback } = await supabaseAdmin
      .from("price_snapshots")
      .insert({
        petrol_price: COLD_PETROL,
        diesel_price: COLD_DIESEL,
        source: "Bundled fallback",
        source_url: ZERA_URL,
        is_live: false,
        effective_period: "unverified",
      })
      .select()
      .single();
    return res.status(200).json(fallback);
  } catch (err) {
    return handleError(res, err);
  }
}
