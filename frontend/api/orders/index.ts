import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../_lib/supabase.js";
import { requireAuth, handleError, ApiError } from "../../_lib/auth.js";
import { roadDistanceKm, etaMinutes } from "../../_lib/geo.js";
import { triage } from "../../_lib/services.js";

function genRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "FL-";
  for (let i = 0; i < 8; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

function genHandoverCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const auth = await requireAuth(req);

    if (req.method === "GET") {
      const { data: orders, error } = await supabaseAdmin
        .from("orders")
        .select(`
          *,
          customer:users!orders_customer_id_fkey(id, full_name, phone_number),
          supplier:users!orders_supplier_id_fkey(id, full_name, phone_number),
          station:stations(*)
        `)
        .eq("customer_id", auth.userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json(orders || []);
    }

    if (req.method === "POST") {
      const {
        pickup_lat, pickup_lng, pickup_address, service_type, fuel_type,
        quantity_litres, symptom, symptom_answer, vehicle_id, notes,
        photo_url, client_request_id, station_id, payment_method, payer_phone,
      } = req.body;

      if (!pickup_lat || !pickup_lng) {
        throw new ApiError("pickup_lat and pickup_lng are required", 400);
      }

      const resolvedService = triage(symptom || null, symptom_answer || null);

      if (client_request_id) {
        const { data: existing } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("client_request_id", client_request_id)
          .single();
        if (existing) return res.status(200).json({ id: existing.id, duplicate: true });
      }

      let distanceKm = 0;
      let fuelCost = 0;
      let deliveryFee = 0;
      let serviceFee = 0;
      let totalAmount = 0;
      let eta = 0;
      let station = null;

      if (resolvedService === "fuel" && pickup_lat && pickup_lng) {
        const { data: stations } = await supabaseAdmin
          .from("stations")
          .select("*")
          .order("id", { ascending: true });

        if (stations && stations.length > 0) {
          const withDist = stations
            .map((s: any) => ({
              ...s,
              distance_km: roadDistanceKm(pickup_lat, pickup_lng, s.lat, s.lng),
            }))
            .filter((s: any) => s.has_petrol || s.has_diesel)
            .sort((a: any, b: any) => a.distance_km - b.distance_km);
          station = withDist[0] || null;
          if (station) {
            distanceKm = station.distance_km;
            eta = etaMinutes(distanceKm);
            const unitPrice = (fuel_type || "").toLowerCase() === "diesel"
              ? station.diesel_price
              : station.petrol_price;
            const litres = quantity_litres || 20;
            fuelCost = Math.round(unitPrice * litres * 100) / 100;
            deliveryFee = Math.round(distanceKm * 3.0 * 100) / 100;
            totalAmount = Math.round((fuelCost + deliveryFee) * 100) / 100;
          }
        }
      } else {
        serviceFee = 10;
        totalAmount = serviceFee;
        eta = 30;
      }

      const orderData: Record<string, unknown> = {
        reference: genRef(),
        customer_id: auth.userId,
        service_type: resolvedService,
        fuel_type: fuel_type || null,
        quantity_litres: quantity_litres || 0,
        symptom: symptom || null,
        symptom_answer: symptom_answer || null,
        vehicle_id: vehicle_id || null,
        pickup_lat,
        pickup_lng,
        pickup_address: pickup_address || "Dropped pin",
        notes: notes || null,
        photo_url: photo_url || null,
        distance_km: distanceKm,
        fuel_cost: fuelCost,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        total_amount: totalAmount,
        status: "pending",
        eta_minutes: eta,
        handover_code: genHandoverCode(),
        client_request_id: client_request_id || null,
        station_id: station?.id || null,
      };

      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert(orderData)
        .select(`
          *,
          customer:users!orders_customer_id_fkey(id, full_name, phone_number),
          supplier:users!orders_supplier_id_fkey(id, full_name, phone_number),
          station:stations(*)
        `)
        .single();
      if (orderError) throw orderError;

      return res.status(201).json(order);
    }

    return res.status(405).json({ detail: "Method not allowed" });
  } catch (err) {
    return handleError(res, err);
  }
}
