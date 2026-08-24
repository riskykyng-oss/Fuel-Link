import { useState } from "react";
import { NavLink } from "react-router-dom";

import { Icon, Mark } from "../../components/brand";
import { useSession } from "../../state";
import type { SupplierStore } from "./useSupplier";
import { CouriersSection } from "./couriers";
import {
  ComplianceCard,
  EarningsChart,
  RequestQueue,
  Kpis,
  LiveMap,
  RecentJobs,
  SealContainers,
  ServicesSection,
  StockCard,
} from "./cards";

function MobileAvailability({ store }: { store: SupplierStore }) {
  const { online, toggleOnline } = store;
  return (
    <button
      type="button"
      className={`mobile-avail${online ? " mobile-avail--on" : ""}`}
      onClick={() => void toggleOnline()}
    >
      <span className={`dot ${online ? "dot--live" : "dot--off"}`} />
      <strong style={{ fontSize: 13 }}>{online ? "Online" : "Offline"}</strong>
      <span className="switch" role="switch" aria-checked={online} aria-label="Toggle availability" />
    </button>
  );
}

function RequestsTab({ store }: { store: SupplierStore }) {
  const { online, requests, summary, accept, decline, placeBid } = store;
  return (
    <div className="pad stack mobile-stack">
      <Kpis summary={summary} requests={requests} orders={store.orders} />
      <RequestQueue
        requests={requests}
        onAccept={accept}
        onDecline={decline}
        onBid={placeBid}
        online={online}
        summary={summary}
      />
      <LiveMap position={store.position} requests={requests} />
    </div>
  );
}

function ActiveTab({ store }: { store: SupplierStore }) {
  const { orders } = store;
  const activeOrders = orders.filter((o) => ["accepted", "in_transit", "arrived"].includes(o.status));
  return (
    <div className="pad stack mobile-stack">
      {activeOrders.length === 0 ? (
        <div className="card">
          <div className="card__head"><h3>No active jobs</h3></div>
          <p className="small muted" style={{ padding: 18 }}>Accept a request to start working.</p>
        </div>
      ) : (
        <>
          <RecentJobs orders={activeOrders} />
          <EarningsChart orders={orders} />
        </>
      )}
    </div>
  );
}

function TeamTab() {
  return (
    <div className="pad">
      <CouriersSection />
    </div>
  );
}

function StockTab({ store }: { store: SupplierStore }) {
  return (
    <div className="pad stack mobile-stack">
      <StockCard summary={store.summary} />
      <ComplianceCard summary={store.summary} />
      <SealContainers />
    </div>
  );
}

function ServicesTab() {
  const { user, refresh } = useSession();
  const profile = user?.supplier_profile ?? null;
  return (
    <div className="pad stack mobile-stack">
      <ServicesSection servicesOffered={profile?.services_offered} onSaved={() => void refresh()} />
    </div>
  );
}

export function SupplierMobile({ store }: { store: SupplierStore }) {
  const { user } = useSession();
  const profile = user?.supplier_profile ?? null;
  const [tab, setTab] = useState<"requests" | "active" | "team" | "stock" | "services">("requests");

  const tabs: { id: string; label: string; icon: "route" | "clock" | "users" | "grid" | "box" | "gear" | "wrench"; link?: string }[] = [
    { id: "requests", label: "Requests", icon: "route" },
    { id: "active", label: "Active", icon: "clock" },
    { id: "team", label: "Team", icon: "users" },
    { id: "stock", label: "Stock", icon: "box" },
    { id: "services", label: "Services", icon: "wrench" },
    { id: "settings-link", label: "Settings", icon: "gear", link: "/settings" },
  ];

  return (
    <div className="app app--dash app--dash-mobile">
      <header className="m-head">
        <span className="row" style={{ gap: 8 }}>
          <Mark size={22} className="acid" />
          <strong style={{ fontSize: 15 }}>
            {profile?.company_name ?? user?.full_name}
          </strong>
        </span>
        <MobileAvailability store={store} />
      </header>

      <main className="m-body">
        {tab === "requests" && <RequestsTab store={store} />}
        {tab === "active" && <ActiveTab store={store} />}
        {tab === "team" && <TeamTab />}
        {tab === "stock" && <StockTab store={store} />}
        {tab === "services" && <ServicesTab />}
      </main>

      <nav className="m-tabs">
        {tabs.map((t) =>
          "link" in t ? (
            <NavLink key={t.id} to={t.link ?? "/"} className={({ isActive }) => (isActive ? "is-active" : undefined)}>
              <Icon name={t.icon} size={21} />
              {t.label}
            </NavLink>
          ) : (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "is-active" : undefined}
              onClick={() => setTab(t.id as "requests" | "active" | "team" | "stock" | "services")}
            >
              <Icon name={t.icon} size={21} />
              {t.label}
            </button>
          ),
        )}
      </nav>
    </div>
  );
}
