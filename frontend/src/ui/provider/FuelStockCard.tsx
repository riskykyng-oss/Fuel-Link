import { Card } from "../primitives/Card";
import { StockBar } from "../primitives/StockBar";
import { Money } from "../primitives/Button";
import { EmptyState } from "../primitives/EmptyState";
import type { StockGradeData } from "../types";

interface FuelStockCardProps {
  grades: StockGradeData[];
}

/** Fuel stock by grade, with live price per grade. Empty-safe. */
export function FuelStockCard({ grades }: FuelStockCardProps) {
  return (
    <Card title="Fuel stock">
      {grades.length === 0 ? (
        <EmptyState icon="box" headline="No grades configured" />
      ) : (
        <div className="flex flex-col gap-4">
          {grades.map((grade) => (
            <div key={grade.label} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <StockBar
                  label={grade.label}
                  litres={grade.litres}
                  capacityLitres={grade.capacityLitres}
                />
                <span className="text-xs text-muted">
                  <Money amountUsd={grade.avgPrice} />/L
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
