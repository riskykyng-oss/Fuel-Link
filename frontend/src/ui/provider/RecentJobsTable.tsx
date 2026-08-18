import { Card } from "../primitives/Card";
import { Money } from "../primitives/Button";
import { EmptyState } from "../primitives/EmptyState";
import { StatusPill } from "../primitives/StatusPill";
import type { RecentJobRowData } from "../types";

interface RecentJobsTableProps {
  rows: RecentJobRowData[];
}

/** Recent completed/pending jobs. Empty-safe; StatusPill + Money in cells. */
export function RecentJobsTable({ rows }: RecentJobsTableProps) {
  return (
    <Card title="Recent jobs">
      {rows.length === 0 ? (
        <EmptyState icon="receipt" headline="No jobs yet" body="Completed jobs will appear here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Job</th>
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="hidden py-2 pr-3 font-medium md:table-cell">Location</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 text-right font-medium">Earnings</th>
                <th className="py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pr-3">
                    <span className="font-medium">{row.type}</span>
                    <span className="ml-2 text-xs text-muted">{row.id}</span>
                  </td>
                  <td className="py-3 pr-3">{row.customer}</td>
                  <td className="hidden py-3 pr-3 text-muted md:table-cell">{row.location}</td>
                  <td className="py-3 pr-3">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="py-3 pr-3 text-right font-medium tabular-nums">
                    <Money amountUsd={row.earningsUsd} />
                  </td>
                  <td className="py-3 text-xs text-muted">{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
