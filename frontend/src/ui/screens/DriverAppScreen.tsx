import { useState } from "react";
import { MobileShell, BottomTabBar } from "../motorist/MobileShell";
import type { TabItem } from "../motorist/MobileShell";
import { AvailabilityToggle } from "../driver/AvailabilityToggle";
import { ActiveJobCard } from "../driver/ActiveJobCard";
import { Button } from "../primitives/Button";
import { Card } from "../primitives/Card";
import { EmptyState } from "../primitives/EmptyState";
import { EarningsSummary } from "../provider/EarningsSummary";
import { Money } from "../primitives/Button";
import { ProgressStepper } from "../primitives/ProgressStepper";
import { OrderSummaryCard } from "../motorist/OtpDisplay";
import { ReportProblem } from "../motorist/CompliancePill";
import type { DriverJobData, OrderLineItemData } from "../types";

const DRIVER_TABS: TabItem[] = [
  { key: "job", icon: "route", label: "Job" },
  { key: "jobs", icon: "receipt", label: "Jobs" },
  { key: "earnings", icon: "chart", label: "Earnings" },
  { key: "profile", icon: "user", label: "Profile" },
];

const ACTIVE_JOB: DriverJobData = {
  id: "J-104",
  serviceType: "Fuel delivery · 20 L",
  customerName: "Aisha Nakato",
  address: "12 Samora Machel Ave, Harare",
  distanceKm: 3.4,
  etaMinutes: 12,
  payoutUsd: 6.5,
};

const DONE_JOBS: DriverJobData[] = [
  { id: "J-098", serviceType: "Tyre change", customerName: "Grace A.", address: "Eastlea", distanceKm: 2.1, etaMinutes: 8, payoutUsd: 4.0 },
  { id: "J-099", serviceType: "Battery boost", customerName: "Dennis K.", address: "Mbare", distanceKm: 1.7, etaMinutes: 6, payoutUsd: 3.5 },
  { id: "J-100", serviceType: "Fuel delivery · 15 L", customerName: "Sandra W.", address: "Highfield", distanceKm: 4.2, etaMinutes: 15, payoutUsd: 5.0 },
];

const LINE_ITEMS: OrderLineItemData[] = [
  { label: "Fuel · 20 L", amountUsd: 35.0 },
  { label: "Delivery fee", amountUsd: 3.5 },
];

interface DriverAppScreenProps {
  onAction?: (action: string) => void;
}

/** Driver console composed from the library. Demo data only. */
export function DriverAppScreen({ onAction }: DriverAppScreenProps) {
  const [tab, setTab] = useState<string>("job");
  const [online, setOnline] = useState(true);
  const [activeJob, setActiveJob] = useState<DriverJobData | null>(ACTIVE_JOB);
  const [code, setCode] = useState("");

  const fire = (action: string) => onAction?.(action);

  return (
    <MobileShell
      header={
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-base font-semibold">Driver console</p>
            <p className="text-xs text-muted">Brian Okello · Tanker T-12</p>
          </div>
          <AvailabilityToggle online={online} onToggle={() => setOnline((o) => !o)} />
        </div>
      }
      footer={<BottomTabBar tabs={DRIVER_TABS} active={tab} onChange={setTab} />}
    >
      {tab === "job" &&
        (activeJob ? (
          <div className="flex flex-col gap-3 pt-3">
            <ActiveJobCard job={activeJob} onCall={() => fire("call-motorist")} />
            <ProgressStepper steps={["Pickup", "En route", "Handover", "Done"]} currentIndex={1} />
            <Button icon="route" onClick={() => fire("start-trip")}>
              Start trip to pickup
            </Button>
            <Button variant="ghost" icon="phone" onClick={() => fire("call-dispatch")}>
              Call dispatch
            </Button>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted">
                Handover code — ask the motorist to read it out
              </label>
              <input
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-12 w-full rounded-control border border-border bg-base px-4 text-center font-mono text-xl tracking-[0.5em] outline-none focus:border-lime"
              />
            </div>
            <OrderSummaryCard lineItems={LINE_ITEMS} totalUsd={38.5} />
            <Button
              disabled={code.length !== 4}
              onClick={() => fire("confirm-handover")}
            >
              Complete handover
            </Button>
            <ReportProblem onReport={() => fire("dispute")} />
            <Button
              variant="ghost"
              onClick={() => {
                setActiveJob(null);
                fire("complete-job");
              }}
            >
              Mark job done (demo)
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-3">
            <EmptyState
              icon="route"
              headline="No active job"
              body="You'll be assigned the next order in your area when you're on duty."
            />
          </div>
        ))}

      {tab === "jobs" && (
        <div className="flex flex-col gap-3 pt-3">
          <Card title="Jobs today">
            {DONE_JOBS.length === 0 ? (
              <EmptyState icon="receipt" headline="No jobs yet" />
            ) : (
              <div className="flex flex-col gap-3">
                {DONE_JOBS.map((job) => (
                  <div key={job.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{job.serviceType}</p>
                      <p className="truncate text-xs text-muted">
                        {job.customerName} · {job.address}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        <Money amountUsd={job.payoutUsd} />
                      </p>
                      <p className="text-[11px] text-muted">{job.id}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "earnings" && (
        <div className="flex flex-col gap-3 pt-3">
          <EarningsSummary
            todayUsd={24.5}
            deltaPct={8}
            completedCount={7}
            responseRatePct={94}
          />
        </div>
      )}

      {tab === "profile" && (
        <div className="flex flex-col gap-3 pt-3">
          <Card title="Account">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lime text-sm font-semibold text-lime-ink">
                BO
              </span>
              <div>
                <p className="text-sm font-semibold">Brian Okello</p>
                <p className="text-xs text-muted">Driver · Tanker T-12 · +263 771 456 789</p>
              </div>
            </div>
          </Card>
          <EmptyState
            icon="gear"
            headline="More settings coming soon"
            body="Payment details, vehicle and notification preferences."
          />
        </div>
      )}
    </MobileShell>
  );
}
