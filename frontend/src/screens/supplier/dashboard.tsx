import { useEffect, useState } from "react";

import { Icon, Loader } from "../../components/brand";
import { useMediaQuery, MOBILE_QUERY } from "../../lib/useMediaQuery";
import { serviceLabel } from "../../lib/services";
import { useSession } from "../../state";
import { Sidebar } from "./sidebar";
import { useSupplier, type SupplierStore } from "./useSupplier";
import { ActiveJob } from "./active-job";
import { SupplierMobile } from "./mobile";
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

const SECTION_TITLES: Record<string, { title: string; sub: string }> = {
  dashboard: { title: "Dashboard", sub: "Live queue, coverage and today's activity." },
  jobs: { title: "Jobs", sub: "Outstanding offers and your recent job history." },
  couriers: { title: "Team", sub: "The people who execute your jobs — shift state and accounts." },
  stock: { title: "Fuel stock", sub: "Litres on the tanker against the ZERA cap." },
  services: { title: "Services", sub: "What you offer motorists and at what callout fee." },
};

function SectionHead({ section }: { section: string }) {
  const meta = SECTION_TITLES[section] ?? { title: section, sub: "" };
  return (
    <div className="dash__section">
      <h1 style={{ margin: 0 }}>{meta.title}</h1>
      <p className="muted small" style={{ marginTop: 4 }}>
        {meta.sub}
      </p>
    </div>
  );
}

function SupplierDesktop({ store }: { store: SupplierStore }) {
  const { online, summary, jobs, orders, position, section, setSection, toggleOnline, accept, decline } =
    store;
  const { user, refresh } = useSession();
  const profile = user?.supplier_profile ?? null;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [section]);

  return (
    <div className="dash">
      <Sidebar section={section} setSection={setSection} online={online} toggleOnline={toggleOnline} />
      <main className="dash__main">
        <div className="dash__head">
          <div>
            <p className="eyebrow">Good to have you back</p>
            <h1 style={{ marginTop: 2 }}>{profile?.company_name ?? user?.full_name}</h1>
          </div>
          <div className="dash__meta">
            {profile?.is_verified && (
              <span className="badge badge--ok">
                <Icon name="shield" size={12} />
                ZERA verified
              </span>
            )}
          </div>
        </div>

        {section === "dashboard" && (
          <div className="stack">
            <Kpis summary={summary} jobs={jobs} orders={orders} />
            <div className="grid-2">
              <ComplianceCard summary={summary} />
              <StockCard summary={summary} />
            </div>
            <div className="grid-2">
              <LiveMap position={position} jobs={jobs} />
              <JobQueue jobs={jobs} onAccept={accept} onDecline={decline} online={online} summary={summary} />
            </div>
            <RecentJobs orders={orders} />
            <EarningsChart orders={orders} />
          </div>
        )}

        {section === "jobs" && (
          <div className="stack">
            <SectionHead section="jobs" />
            <JobQueue jobs={jobs} onAccept={accept} onDecline={decline} online={online} summary={summary} />
            <RecentJobs orders={orders} />
          </div>
        )}

        {section === "couriers" && (
          <div className="stack">
            <SectionHead section="couriers" />
            <CouriersSection />
          </div>
        )}

        {section === "services" && (
          <div className="stack">
            <SectionHead section="services" />
            <ServicesSection servicesOffered={profile?.services_offered} onSaved={() => void refresh()} />
          </div>
        )}

        {section === "stock" && (
          <div className="stack">
            <SectionHead section="stock" />
            <div className="grid-2">
              <StockCard summary={summary} />
              <ComplianceCard summary={summary} />
            </div>
            <SealContainers />
          </div>
        )}
      </main>
    </div>
  );
}

export function SupplierHome() {
  const store = useSupplier();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [viewDashboard, setViewDashboard] = useState(false);

  useEffect(() => { if (!store.active) setViewDashboard(false); }, [store.active]);

  if (store.loading) {
    return (
      <div className="pad stack" style={{ minHeight: "70vh", justifyContent: "center" }}>
        <Loader label="Loading your console" />
      </div>
    );
  }

  if (store.active && !viewDashboard) {
    return (
      <div className={isMobile ? "pad" : "dash dash--active"}>
        {!isMobile && <Sidebar section={store.section} setSection={store.setSection} online={store.online} toggleOnline={store.toggleOnline} />}
        <main className="dash__main">
          <div className="stack">
            <button
              type="button"
              className="btn btn--sm"
              style={{ alignSelf: "flex-end" }}
              onClick={() => setViewDashboard(true)}
            >
              <Icon name="route" size={14} /> View dashboard
            </button>
            <ActiveJob store={store} />
          </div>
        </main>
      </div>
    );
  }

  if (store.active && viewDashboard) {
    return (
      <div className={isMobile ? "pad" : "dash dash--active"}>
        {!isMobile && <Sidebar section={store.section} setSection={store.setSection} online={store.online} toggleOnline={store.toggleOnline} />}
        <main className="dash__main">
          <div className="stack">
            <div className="tile" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div className="row" style={{ gap: 8, flex: 1 }}>
                <span className="dot dot--live" />
                <strong className="data small">{store.active.reference}</strong>
                <span className="small muted">{serviceLabel(store.active.service_type)} · {store.active.status.replace("_", " ")}</span>
              </div>
              <button type="button" className="btn btn--sm btn--primary" onClick={() => setViewDashboard(false)}>
                <Icon name="route" size={14} /> Continue job
              </button>
            </div>
            {isMobile ? <SupplierMobile store={store} /> : <SupplierDesktop store={store} />}
          </div>
        </main>
      </div>
    );
  }

  return isMobile ? <SupplierMobile store={store} /> : <SupplierDesktop store={store} />;
}
