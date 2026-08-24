import { useCallback, useEffect, useState } from "react";

import { api, ApiError, type Order, type SupplierSummary } from "../../lib/api";
import { HARARE } from "../../lib/services";
import { useSession, useToast } from "../../state";

export type Section = "requests" | "active" | "couriers" | "stock" | "services";

export const POLL_MS = 6000;

export interface SupplierStore {
  online: boolean;
  summary: SupplierSummary | null;
  requests: Order[];
  orders: Order[];
  active: Order | null;
  loading: boolean;
  position: [number, number];
  section: Section;
  setSection: (section: Section) => void;
  toggleOnline: () => Promise<void>;
  accept: (order: Order) => Promise<void>;
  decline: (order: Order) => Promise<void>;
  placeBid: (order: Order, amount: number, note?: string) => Promise<void>;
  load: () => Promise<void>;
}

export function useSupplier(): SupplierStore {
  const { user, refresh } = useSession();
  const { notify } = useToast();
  const profile = user?.supplier_profile ?? null;

  const [online, setOnline] = useState(profile?.is_online ?? false);
  const [summary, setSummary] = useState<SupplierSummary | null>(null);
  const [requests, setRequests] = useState<Order[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [active, setActive] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("requests");
  const [position, setPosition] = useState<[number, number]>([
    profile?.current_lat ?? HARARE[0],
    profile?.current_lng ?? HARARE[1],
  ]);

  const load = useCallback(async () => {
    try {
      const current = await api.activeOrder();
      setActive(current);
      const [feed, stats, history] = await Promise.all([
        current ? Promise.resolve([]) : api.pendingRequests(),
        api.supplierSummary(),
        api.orders(),
      ]);
      setRequests(feed);
      setSummary(stats);
      setOrders(history);
    } catch {
      notify("Cannot reach the dispatch server.", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!navigator.geolocation || !online) return;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPosition(next);
        void api.pushLocation(next[0], next[1]).catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [online]);

  async function toggleOnline() {
    const next = !online;
    setOnline(next);
    try {
      await api.setOnline(next);
      await refresh();
      notify(next ? "You are online. Requests will come through." : "You are offline.");
    } catch {
      setOnline(!next);
      notify("Could not change your status.", "error");
    }
  }

  async function accept(order: Order) {
    try {
      setActive(await api.acceptOrder(order.id));
      notify(`Job ${order.reference} is yours.`);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "That job is gone.", "error");
      void load();
    }
  }

  async function decline(order: Order) {
    try {
      await api.rejectOrder(order.id);
      setRequests((prev) => prev.filter((r) => r.id !== order.id));
      notify(`Job ${order.reference} declined.`);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not decline.", "error");
    }
  }

  async function placeBid(order: Order, amount: number, note?: string) {
    try {
      await api.placeBid(order.id, amount, note);
      notify(`Your offer of $${amount.toFixed(2)} sent for ${order.reference}.`);
      setRequests((prev) => prev.filter((r) => r.id !== order.id));
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not send offer.", "error");
    }
  }

  return {
    online,
    summary,
    requests,
    orders,
    active,
    loading,
    position,
    section,
    setSection,
    toggleOnline,
    accept,
    decline,
    placeBid,
    load,
  };
}
