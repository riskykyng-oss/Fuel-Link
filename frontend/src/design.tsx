import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./ui/ui.css";

import { cn } from "./ui/cn";
import { Icon } from "./ui/icons";
import type { IconName } from "./ui/icons";
import { Button, Card, Money, ProgressStepper, StatusPill, VerifiedBadge, EmptyState, StockBar } from "./ui";
import { ProviderDashboardScreen } from "./ui/screens/ProviderDashboardScreen";
import { MotoristAppScreen } from "./ui/screens/MotoristAppScreen";
import { GarageDashboardScreen } from "./ui/screens/GarageDashboardScreen";
import { DriverAppScreen } from "./ui/screens/DriverAppScreen";

type GalleryTab = "primitives" | "provider" | "garage" | "motorist" | "driver";

const TABS: Array<{ key: GalleryTab; label: string }> = [
  { key: "primitives", label: "Primitives" },
  { key: "provider", label: "Provider" },
  { key: "garage", label: "Garage" },
  { key: "motorist", label: "Motorist" },
  { key: "driver", label: "Driver" },
];

const ICONS: IconName[] = [
  "home", "grid", "bolt", "users", "box", "tag", "car", "alert", "gear", "receipt",
  "wallet", "user", "phone", "shield", "check", "clock", "route", "chart", "share",
  "pin", "pencil", "bell", "sun", "siren", "arrow-up", "arrow-down", "calendar",
  "chevron-right", "star", "nozzle", "tow", "battery", "tyre", "key", "wrench",
];

function LoggedAction({ name }: { name: string }) {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setCount((c) => c + 1)}
      className="rounded-control border border-border px-3 py-2 text-xs text-muted hover:bg-surface"
    >
      {name} · pressed {count}
    </button>
  );
}

function PrimitiveGallery() {
  const [panicked, setPanicked] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title="Buttons & Money">
        <div className="flex flex-col items-start gap-3">
          <div className="flex flex-wrap gap-2">
            <Button icon="check">Primary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger" icon="siren">Danger</Button>
          </div>
          <Button fullWidth>Full width primary</Button>
          <Button fullWidth disabled>Disabled</Button>
          <p className="text-sm text-muted">
            Money: <Money amountUsd={38.5} /> · <Money amountUsd={0} />
          </p>
        </div>
      </Card>

      <Card title="StatusPill & VerifiedBadge">
        <div className="flex flex-wrap gap-2">
          <StatusPill status="completed" />
          <StatusPill status="en_route" />
          <StatusPill status="accepted" />
          <StatusPill status="declined" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <VerifiedBadge label="Verified" />
          <VerifiedBadge label="Compliant" verifiedAt="12 Mar" />
        </div>
      </Card>

      <Card title="ProgressStepper">
        <ProgressStepper steps={["Requested", "En route", "Handover", "Done"]} currentIndex={1} />
        <div className="mt-6">
          <ProgressStepper steps={["Requested", "Done"]} currentIndex={2} />
        </div>
      </Card>

      <Card title="StockBar & EmptyState">
        <div className="flex flex-col gap-3">
          <StockBar label="Petrol" litres={820} capacityLitres={1000} />
          <StockBar label="Diesel" litres={120} capacityLitres={1000} />
          <StockBar label="Empty tanks" litres={0} capacityLitres={500} />
        </div>
        <EmptyState icon="box" headline="No grades configured" />
      </Card>

      <Card title="Empty lists & actions">
        <EmptyState
          icon="grid"
          headline="No incoming jobs"
          body="New requests will appear here as they come in."
          action={
            <Button
              onClick={() => setPanicked(true)}
              className={panicked ? "bg-danger text-base" : ""}
            >
              {panicked ? "Stay calm" : "Simulate action"}
            </Button>
          }
        />
        <LoggedAction name="onAccept(…)" />
        <LoggedAction name="onPanic(…)" />
      </Card>

      <Card title="Icons">
        <div className="flex flex-wrap gap-2">
          {ICONS.map((name) => (
            <span
              key={name}
              title={name}
              className="flex h-11 w-11 items-center justify-center rounded-control border border-border text-muted"
            >
              <Icon name={name} size={18} />
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Gallery() {
  const [tab, setTab] = useState<GalleryTab>("primitives");
  return (
    <div className="min-h-screen bg-base text-text">
      <header className="sticky top-0 z-20 border-b border-border bg-base/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-control bg-lime text-lime-ink">
            <Icon name="nozzle" size={18} />
          </span>
          <div>
            <h1 className="text-base font-bold">
              FuelLink <span className="text-lime-text">Component library</span>
            </h1>
            <p className="text-xs text-muted">React 19 · Vite · Tailwind · design tokens only</p>
          </div>
          <div className="ml-auto flex gap-1 rounded-control border border-border p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "min-h-10 rounded-control px-4 text-sm font-medium transition-colors",
                  tab === t.key ? "bg-lime text-lime-ink" : "text-muted hover:text-text",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 py-6">
        {tab === "primitives" && <PrimitiveGallery />}
        {tab === "provider" && <ProviderDashboardScreen />}
        {tab === "garage" && <GarageDashboardScreen />}
        {tab === "motorist" && (
          <div className="mx-auto max-w-[390px] overflow-hidden rounded-card border border-border">
            <MotoristAppScreen />
          </div>
        )}
        {tab === "driver" && (
          <div className="mx-auto max-w-[390px] overflow-hidden rounded-card border border-border">
            <DriverAppScreen />
          </div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
