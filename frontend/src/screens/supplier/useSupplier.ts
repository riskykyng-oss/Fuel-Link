import { useCallback, useEffect, useState } from "react";

import { api, ApiError, type Order, type SupplierSummary } from "../../lib/api";
import { HARARE } from "../../lib/services";
import { useSession, useToast } from "../../state";

export type Section = "dashboard" | "jobs" | "couriers" | "stock" | "services";

export const POLL_MS = 6000;

export interface SupplierStore {
  online: boolean;
  summary: SupplierSummary | null;
  jobs: Order[];
  orders: Order[];
  active: Order | null;
  loading: boolean;
  position: [number, number];
  section: Section;
  setSection: (section: Section) => void;
  toggleOnline: () => Promise<void>;
  accept: (order: Order) => Promise<void>;
  decline: (order: Order) => Promise<void>;
  load: () => Promise<void>;
}

/** All data + actions for the garage workspace, shared by desktop & mobile layouts. */
export function useSupplier(): SupplierStore {
  const { user, refresh } = useSession();
  const { notify } = useToast();
  const profile = user?.supplier_profile ?? null;

  const [online, setOnline] = useState(profile?.is_online ?? false);
  const [summary, setSummary] = useState<SupplierSummary | null>(null);
  const [jobs, setJobs] = useState<Order[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [active, setActive] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("dashboard");
  const [position, setPosition] = useState<[number, number]>([
    profile?.current_lat ?? HARARE[0],
    profile?.current_lng ?? HARARE[1],
  ]);

  const load = useCallback(async () => {
    try {
      const current = await api.activeOrder();
      setActive(current);
      const [feed, stats, history] = await Promise.all([
        current ? Promise.resolve([]) : api.availableJobs(),
        api.supplierSummary(),
        api.orders(),
      ]);
      setJobs(feed);
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
      notify(next ? "You are online. Jobs will come through." : "You are offline.");
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
      setJobs((prev) => prev.filter((j) => j.id !== order.id));
      notify(`Job ${order.reference} declined.`);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not decline.", "error");
    }
  }

  return {
    online,
    summary,
    jobs,
    orders,
    active,
    loading,
    position,
    section,
    setSection,
    toggleOnline,
    accept,
    decline,
    load,
  };
}
