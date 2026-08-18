import { useState } from "react";
import { AppShell } from "../provider/AppShell";
import type { SidebarNavItem } from "../provider/AppShell";
import { TopBar, ProviderIdentityCard } from "../provider/TopBar";
import { KpiRow } from "../provider/KpiRow";
import type { KpiItem } from "../provider/KpiRow";
import { LiveJobMap } from "../provider/LiveJobMap";
import { HARARE_CENTER } from "../provider/LiveJobMap";
import { IncomingJobsPanel } from "../provider/IncomingJobsPanel";
import { EarningsSummary } from "../provider/EarningsSummary";
import { RecentJobsTable } from "../provider/RecentJobsTable";
import { SupportCard } from "../provider/SupportCard";
import type { JobRequestData, MapMarker, RecentJobRowData } from "../types";

const NAV_ITEMS: SidebarNavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "home" },
  { key: "live", label: "Live jobs", icon: "bolt" },
  { key: "drivers", label: "Drivers", icon: "car" },
  { key: "mechanics", label: "Mechanics", icon: "wrench" },
  { key: "services", label: "Services", icon: "grid" },
  { key: "pricing", label: "Pricing", icon: "tag" },
  { key: "reviews", label: "Reviews", icon: "star" },
  { key: "disputes", label: "Disputes", icon: "alert", badge: 1 },
  { key: "settings", label: "Settings", icon: "gear" },
];

const KPIS: KpiItem[] = [
  { icon: "bolt", label: "Incoming", value: "4" },
  { icon: "route", label: "Active", value: "2" },
  { icon: "check", label: "Completed today", value: "11" },
  { icon: "chart", label: "Earnings today", value: "$96.00" },
  { icon: "clock", label: "Response rate", value: "88%" },
];

const MAP_JOBS: MapMarker[] = [
  { id: "m1", lat: -17.8188, lng: 31.0606, tone: "lime", label: "Tyre · 1.5 km" },
  { id: "m2", lat: -17.8321, lng: 31.0478, tone: "success", label: "Battery · 3 km" },
  { id: "m3", lat: -17.8452, lng: 31.0659, tone: "blue", label: "Tow · 5 km" },
  { id: "m4", lat: -17.7992, lng: 31.0314, tone: "muted", label: "Done · Mbare" },
  { id: "m5", lat: -17.8551, lng: 31.0783, tone: "warn", label: "High demand" },
];

const INCOMING: JobRequestData[] = [
  {
    id: "J-204",
    serviceType: "Tyre change",
    customerName: "Aisha Nakato",
    address: "Samora Machel Ave, Harare",
    distanceKm: 1.5,
    ageMinutes: 1,
    summary: "Flat rear tyre, compact sedan",
    amountUsd: 18.0,
  },
  {
    id: "J-205",
    serviceType: "Battery boost",
    customerName: "Brian Okello",
    address: "Eastlea, Grant Rd",
    distanceKm: 3.0,
    ageMinutes: 4,
    summary: "Dead battery, hatchback",
    amountUsd: 15.0,
  },
  {
    id: "J-206",
    serviceType: "Breakdown assist",
    customerName: "Cathy Mutesi",
    address: "Borrowdale, Riverside",
    distanceKm: 5.2,
    ageMinutes: 7,
    summary: "Engine overheating, limping",
    amountUsd: 32.0,
  },
  {
    id: "J-207",
    serviceType: "Lockout",
    customerName: "Dennis Katende",
    address: "Highfield, Chembira",
    distanceKm: 4.4,
    ageMinutes: 9,
    summary: "Keys locked in the car",
    amountUsd: 12.0,
  },
];

const RECENT: RecentJobRowData[] = [
  { id: "J-198", type: "Tyre change", customer: "Grace A.", location: "Eastlea", status: "completed", earningsUsd: 18.0, time: "09:10" },
  { id: "J-199", type: "Battery boost", customer: "Dennis K.", location: "Mbare", status: "completed", earningsUsd: 15.0, time: "09:38" },
  { id: "J-200", type: "Towing", customer: "Sandra W.", location: "Highfield", status: "completed", earningsUsd: 42.0, time: "10:04" },
  { id: "J-201", type: "Mechanic visit", customer: "Peter M.", location: "Borrowdale", status: "en_route", earningsUsd: 32.0, time: "10:29" },
  { id: "J-202", type: "Lockout", customer: "Fiona B.", location: "CBD", status: "declined", earningsUsd: 0.0, time: "10:44" },
];

interface GarageDashboardScreenProps {
  onNavigate?: (key: string) => void;
}

/** Full garage/mechanic dashboard composed from the library. Demo data only. */
export function GarageDashboardScreen({ onNavigate }: GarageDashboardScreenProps) {
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
          subline="Kuwadzana Auto Clinic"
          weather={{ label: "Cloudy", tempC: 21 }}
          unreadCount={2}
          account={{ name: "Joseph Chirwa", initials: "JC" }}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <ProviderIdentityCard
          name="Kuwadzana Auto Clinic"
          address="Kuwadzana, Harare"
          verified
        />
        <KpiRow items={KPIS} />
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
        <EarningsSummary
          todayUsd={96.0}
          deltaPct={-4}
          completedCount={11}
          responseRatePct={88}
        />
        <RecentJobsTable rows={RECENT} />
        <SupportCard phone="0800 246 810" hours="06:00–22:00" />
      </div>
    </AppShell>
  );
}
