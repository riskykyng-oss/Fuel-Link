import { useState } from "react";
import { NavLink } from "react-router-dom";

import { Icon, Mark } from "../../components/brand";
import { useSession } from "../../state";
import type { SupplierStore } from "./useSupplier";
import { CouriersSection } from "./couriers";
import {
  ComplianceCard,
  EarningsChart,
  JobQueue,
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

function DashboardTab({ store }: { store: SupplierStore }) {
  const { online, summary, jobs, orders, position, accept, decline } = store;
  return (
    <div className="pad stack mobile-stack">
      <Kpis summary={summary} jobs={jobs} orders={orders} />
      <LiveMap position={position} jobs={jobs} />
      <JobQueue jobs={jobs} onAccept={accept} onDecline={decline} online={online} summary={summary} />
      <div className="grid-2">
        <ComplianceCard summary={summary} />
        <StockCard summary={summary} />
      </div>
      <SealContainers />
      <RecentJobs orders={orders} />
      <EarningsChart orders={orders} />
    </div>
  );
}

function JobsTab({ store }: { store: SupplierStore }) {
  const { online, jobs, orders, accept, decline, summary } = store;
  return (
    <div className="pad stack mobile-stack">
      <JobQueue jobs={jobs} onAccept={accept} onDecline={decline} online={online} summary={summary} />
      <RecentJobs orders={orders} />
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

function ServicesTab() {
  const { user, refresh } = useSession();
  return <ServicesSection servicesOffered={user?.supplier_profile?.services_offered} onSaved={() => void refresh()} />;
}

export function SupplierMobile({ store }: { store: SupplierStore }) {
  const { user } = useSession();
  const profile = user?.supplier_profile ?? null;
  const [tab, setTab] = useState<"mobile-dashboard" | "mobile-jobs" | "mobile-team" | "mobile-services">(
    "mobile-dashboard",
  );

  const tabs: { id: string; label: string; icon: "home" | "clock" | "users" | "grid" | "wallet" | "gear"; link?: string }[] = [
    { id: "mobile-dashboard", label: "Dashboard", icon: "home" as const },
    { id: "mobile-jobs", label: "Jobs", icon: "clock" as const },
    { id: "mobile-team", label: "Team", icon: "users" as const },
    { id: "mobile-services", label: "Services", icon: "grid" as const },
    { id: "earnings-link", label: "Earnings", icon: "wallet" as const, link: "/earnings" },
    { id: "settings-link", label: "Settings", icon: "gear" as const, link: "/settings" },
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
        {tab === "mobile-dashboard" && <DashboardTab store={store} />}
        {tab === "mobile-jobs" && <JobsTab store={store} />}
        {tab === "mobile-team" && <TeamTab />}
        {tab === "mobile-services" && <ServicesTab />}
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
              onClick={() => setTab(t.id as "mobile-dashboard" | "mobile-jobs" | "mobile-team" | "mobile-services")}
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
