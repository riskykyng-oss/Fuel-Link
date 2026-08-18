import { useState } from "react";
import { MobileShell, BottomTabBar } from "../motorist/MobileShell";
import { LocationHeader } from "../motorist/LocationHeader";
import { ServiceGrid } from "../motorist/ServiceGrid";
import { UnsafeButton, OfflineHint } from "../motorist/UnsafeButton";
import { EtaHeader, CourierCard } from "../motorist/EtaHeader";
import { ShareTripButton } from "../motorist/ShareTripButton";
import { OtpDisplay, OrderSummaryCard } from "../motorist/OtpDisplay";
import { CompliancePill, ReportProblem } from "../motorist/CompliancePill";
import { StepHeader } from "../motorist/StepHeader";
import { StationCard } from "../motorist/StationCard";
import { GarageCard } from "../motorist/GarageCard";
import { Card } from "../primitives/Card";
import { EmptyState } from "../primitives/EmptyState";
import type {
  GarageData,
  OrderLineItemData,
  ServiceTileData,
  StationData,
  TabKey,
} from "../types";

const CHOICES: ServiceTileData[] = [
  { key: "fuel", icon: "nozzle", label: "Fuel", sublabel: "Petrol & diesel, delivered" },
  { key: "assist", icon: "wrench", label: "Assistance", sublabel: "Nearest mechanics" },
];

const STATIONS: StationData[] = [
  {
    id: "st-1",
    name: "Zuva Fuels · CBD",
    verified: true,
    distanceKm: 1.2,
    rating: 4.4,
    openNow: true,
    grades: [
      { label: "Petrol", priceUsdPerLitre: 1.75, available: true },
      { label: "Diesel", priceUsdPerLitre: 1.68, available: true },
    ],
  },
  {
    id: "st-2",
    name: "Puma Energy · Eastlea",
    verified: true,
    distanceKm: 2.3,
    rating: 4.1,
    openNow: true,
    grades: [
      { label: "Petrol", priceUsdPerLitre: 1.72, available: false },
      { label: "Diesel", priceUsdPerLitre: 1.65, available: true },
    ],
  },
  {
    id: "st-3",
    name: "TotalEnergies · Borrowdale",
    verified: false,
    distanceKm: 3.8,
    rating: 4.6,
    openNow: false,
    grades: [
      { label: "Petrol", priceUsdPerLitre: 1.78, available: true },
      { label: "Diesel", priceUsdPerLitre: 1.7, available: true },
    ],
  },
];

const GARAGES: GarageData[] = [
  {
    id: "gr-1",
    name: "Kuwadzana Auto Clinic",
    verified: true,
    distanceKm: 2.4,
    rating: 4.7,
    etaMinutes: 10,
    services: ["Tyre", "Battery", "Breakdown"],
  },
  {
    id: "gr-2",
    name: "Borrowdale Service Centre",
    verified: true,
    distanceKm: 3.1,
    rating: 4.5,
    etaMinutes: 14,
    services: ["Mechanic", "Towing", "Battery"],
  },
  {
    id: "gr-3",
    name: "Highfield Garage",
    verified: false,
    distanceKm: 4.6,
    rating: 4.2,
    etaMinutes: 20,
    services: ["Towing", "Tyre", "Lockout"],
  },
];

const LINE_ITEMS: OrderLineItemData[] = [
  { label: "Fuel · 20 L", amountUsd: 35.0 },
  { label: "Delivery fee", amountUsd: 3.5 },
];

interface MotoristAppScreenProps {
  onAction?: (action: string) => void;
}

/** Full motorist app frame composed from the library. Demo data only. */
export function MotoristAppScreen({ onAction }: MotoristAppScreenProps) {
  const [tab, setTab] = useState<TabKey>("home");
  const [flow, setFlow] = useState<"choose" | "fuel" | "assist">("choose");

  const fire = (action: string) => onAction?.(action);

  return (
    <MobileShell
      header={
        <LocationHeader address="12 Samora Machel Ave, Harare" onEdit={() => fire("edit-address")} fixAgeSeconds={18} />
      }
      footer={<BottomTabBar active={tab} onChange={(key) => setTab(key as TabKey)} />}
    >
      {tab === "home" && flow === "choose" && (
        <div className="flex flex-col gap-3 pt-3">
          <OfflineHint />
          <ServiceGrid
            tiles={CHOICES}
            selected={flow}
            onSelect={(key) => setFlow(key as "fuel" | "assist")}
          />
          <UnsafeButton onPanic={() => fire("panic")} />
        </div>
      )}

      {tab === "home" && flow === "fuel" && (
        <div className="flex flex-col gap-3">
          <StepHeader
            title="Gas stations near you"
            subtitle="Choose where to fuel up"
            onBack={() => setFlow("choose")}
          />
          {STATIONS.length === 0 ? (
            <EmptyState
              icon="nozzle"
              headline="No stations nearby"
              body="Try widening your search or check back soon."
            />
          ) : (
            STATIONS.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                onRequest={(id) => fire(`request-station:${id}`)}
              />
            ))
          )}
          <UnsafeButton onPanic={() => fire("panic")} />
        </div>
      )}

      {tab === "home" && flow === "assist" && (
        <div className="flex flex-col gap-3">
          <StepHeader
            title="Nearest garages"
            subtitle="Mechanics close to you"
            onBack={() => setFlow("choose")}
          />
          {GARAGES.length === 0 ? (
            <EmptyState
              icon="wrench"
              headline="No garages nearby"
              body="Try widening your search or check back soon."
            />
          ) : (
            GARAGES.map((garage) => (
              <GarageCard
                key={garage.id}
                garage={garage}
                onRequest={(id) => fire(`request-garage:${id}`)}
              />
            ))
          )}
          <UnsafeButton onPanic={() => fire("panic")} />
        </div>
      )}

      {tab === "orders" && (
        <div className="flex flex-col gap-3 pt-3">
          <EtaHeader etaMinutes={12} distanceKm={3.4} />
          <CourierCard
            name="Brian Okello"
            verified
            stationStaffId="S-8821"
            sealedContainerId="SC-1045"
            onCall={() => fire("call-courier")}
          />
          <ShareTripButton onShare={() => fire("share-trip")} />
          <OtpDisplay code="4827" />
          <OrderSummaryCard lineItems={LINE_ITEMS} totalUsd={38.5} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Read this code out to your provider — they enter it, never you.</span>
            <CompliancePill capUsdPerLitre={1.8} verifiedAt="12 Mar" />
          </div>
          <ReportProblem onReport={() => fire("dispute")} />
        </div>
      )}

      {tab === "profile" && (
        <div className="flex flex-col gap-3 pt-3">
          <Card title="Account">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lime text-sm font-semibold text-lime-ink">
                AN
              </span>
              <div>
                <p className="text-sm font-semibold">Aisha Nakato</p>
                <p className="text-xs text-muted">+263 771 234 567</p>
              </div>
            </div>
          </Card>
          <EmptyState
            icon="gear"
            headline="More settings coming soon"
            body="Language, payment methods and notification preferences."
          />
        </div>
      )}
    </MobileShell>
  );
}
