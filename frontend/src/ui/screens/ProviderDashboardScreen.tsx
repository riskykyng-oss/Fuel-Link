import { useState } from "react";
import { AppShell } from "../provider/AppShell";
import type { SidebarNavItem } from "../provider/AppShell";
import { TopBar, ProviderIdentityCard } from "../provider/TopBar";
import { KpiRow } from "../provider/KpiRow";
import type { KpiItem } from "../provider/KpiRow";
import { LiveJobMap } from "../provider/LiveJobMap";
import { IncomingJobsPanel } from "../provider/IncomingJobsPanel";
import { ComplianceCard } from "../provider/ComplianceCard";
import { FuelStockCard } from "../provider/FuelStockCard";
import { EarningsSummary } from "../provider/EarningsSummary";
import { RecentJobsTable } from "../provider/RecentJobsTable";
import { SupportCard } from "../provider/SupportCard";
import type { JobRequestData, MapMarker, RecentJobRowData, StockGradeData } from "../types";
import { HARARE_CENTER } from "../provider/LiveJobMap";

const NAV_ITEMS: SidebarNavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "home" },
  { key: "live", label: "Live jobs", icon: "bolt" },
  { key: "couriers", label: "Couriers", icon: "users" },
  { key: "stock", label: "Fuel stock", icon: "box" },
  { key: "pricing", label: "Pricing", icon: "tag" },
  { key: "fleet", label: "Fleet accounts", icon: "car" },
  { key: "disputes", label: "Disputes", icon: "alert", badge: 2 },
  { key: "settings", label: "Settings", icon: "gear" },
];

const KPIS: KpiItem[] = [
  { icon: "bolt", label: "Incoming", value: "6" },
  { icon: "route", label: "Active", value: "3" },
  { icon: "check", label: "Completed today", value: "14" },
  { icon: "chart", label: "Earnings today", value: "$184.20", linkLabel: "Details" },
  { icon: "clock", label: "Response rate", value: "92%" },
];

const MAP_JOBS: MapMarker[] = [
  { id: "m1", lat: -17.8158, lng: 31.0656, tone: "lime", label: "Fuel · 2 km" },
  { id: "m2", lat: -17.8301, lng: 31.0438, tone: "success", label: "Tyre · 4 km" },
  { id: "m3", lat: -17.8422, lng: 31.0619, tone: "blue", label: "Tow · 6 km" },
  { id: "m4", lat: -17.7992, lng: 31.0314, tone: "muted", label: "Battery · 3 km" },
  { id: "m5", lat: -17.8581, lng: 31.0813, tone: "warn", label: "High demand" },
];

const INCOMING: JobRequestData[] = [
  {
    id: "J-104",
    serviceType: "Fuel delivery",
    customerName: "Aisha Nakato",
    address: "Kololo, Acacia Ave",
    distanceKm: 2.1,
    ageMinutes: 1,
    summary: "20 L petrol, sealed container",
    amountUsd: 38.5,
  },
  {
    id: "J-105",
    serviceType: "Breakdown assist",
    customerName: "Brian Okello",
    address: "Ntinda, Kisementi Rd",
    distanceKm: 4.4,
    ageMinutes: 4,
    summary: "Flat tyre, compact sedan",
    amountUsd: 21.0,
  },
  {
    id: "J-106",
    serviceType: "Battery boost",
    customerName: "Cathy Mutesi",
    address: "Bukoto, Muwanga Rd",
    distanceKm: 3.0,
    ageMinutes: 7,
    summary: "Dead battery, hatchback",
    amountUsd: 15.0,
  },
];

const GRADES: StockGradeData[] = [
  { label: "Petrol", litres: 820, capacityLitres: 1000, avgPrice: 1.75 },
  { label: "Diesel", litres: 390, capacityLitres: 1000, avgPrice: 1.68 },
  { label: "Kerosene", litres: 140, capacityLitres: 500, avgPrice: 1.55 },
];

const RECENT: RecentJobRowData[] = [
  { id: "J-098", type: "Fuel delivery", customer: "Grace A.", location: "Nakasero", status: "completed", earningsUsd: 38.5, time: "09:12" },
  { id: "J-099", type: "Battery boost", customer: "Dennis K.", location: "Muyenga", status: "completed", earningsUsd: 15.0, time: "09:40" },
  { id: "J-100", type: "Tyre repair", customer: "Sandra W.", location: "Kiswa", status: "completed", earningsUsd: 21.0, time: "10:05" },
  { id: "J-101", type: "Fuel delivery", customer: "Peter M.", location: "Naguru", status: "en_route", earningsUsd: 42.0, time: "10:31" },
  { id: "J-102", type: "Tow", customer: "Fiona B.", location: "Old Kampala", status: "declined", earningsUsd: 0.0, time: "10:47" },
];

interface ProviderDashboardScreenProps {
  onNavigate?: (key: string) => void;
}

/** Full provider dashboard composed from the library. Demo data only. */
export function ProviderDashboardScreen({ onNavigate }: ProviderDashboardScreenProps) {
  const [activeKey, setActiveKey] = useState("dashboard");
  const [jobs, setJobs] = useState(INCOMING);

  const handleSelect = (key: string) => {
    setActiveKey(key);
    onNavigate?.(key);
  };

  return (
    <AppShell
      activeKey={activeKey}
      onSelect={handleSelect}
      navItems={NAV_ITEMS}
      header={
        <TopBar
          greeting="Good morning"
          subline="FuelLink Supply Co. · Ntinda"
          weather={{ label: "Sunny", tempC: 26 }}
          unreadCount={3}
          account={{ name: "Noah Sematimba", initials: "NS" }}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <ProviderIdentityCard
          name="FuelLink Supply Co."
          address="Ntinda, Kisementi Road, Kampala"
          verified
        />
        <KpiRow
          items={KPIS.map((kpi, i) =>
            kpi.linkLabel
              ? { ...kpi, onLinkClick: () => handleSelect("pricing") }
              : kpi.icon === "bolt"
                ? { ...kpi, linkLabel: "View all", onLinkClick: () => handleSelect("live") }
                : i === 2
                  ? { ...kpi, linkLabel: "View all", onLinkClick: () => handleSelect("couriers") }
                  : kpi,
          )}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LiveJobMap jobs={MAP_JOBS} center={HARARE_CENTER} />
          </div>
          <IncomingJobsPanel
            jobs={jobs}
            unreadCount={jobs.length}
            onAccept={(id) => setJobs((prev) => prev.filter((j) => j.id !== id))}
            onDecline={(id) => setJobs((prev) => prev.filter((j) => j.id !== id))}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ComplianceCard capUsdPerLitre={1.8} ownUsdPerLitre={1.75} verifiedAt="12 Mar" />
          <FuelStockCard grades={GRADES} />
          <EarningsSummary
            todayUsd={184.2}
            deltaPct={12}
            completedCount={14}
            responseRatePct={92}
          />
        </div>
        <RecentJobsTable rows={RECENT} />
        <SupportCard phone="0800 123 456" hours="24/7" />
      </div>
    </AppShell>
  );
}
