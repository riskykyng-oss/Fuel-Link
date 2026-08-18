import { EmptyState, TopBar } from "../../components/ui";
import { api, ApiError, type Order } from "../../lib/api";
import { serviceName } from "../../lib/services";
import { useToast } from "../../state";

export function DeliveredScreen({ order, onCleared, onBack }: { order: Order; onCleared: () => void; onBack?: () => void }) {
  const { notify } = useToast();

  async function rate(stars: number) {
    try {
      await api.rateOrder(order.id, stars);
      notify("Thanks — rating saved.");
      onCleared();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not save the rating.", "error");
    }
  }

  return (
    <div className="screen">
      <TopBar title={order.reference} onBack={onBack} />
      <div className="pad stack">
        <EmptyState
          icon="check"
          title="Delivered"
          body={`${order.quantity_litres > 0 ? `${order.quantity_litres.toFixed(0)} litres of ${order.fuel_type}` : serviceName(order.service_type)} completed for $${order.total_amount.toFixed(2)}.`}
        />
        <p className="eyebrow" style={{ textAlign: "center" }}>
          Rate your provider
        </p>
        <div className="row" style={{ justifyContent: "center", gap: 8 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className="btn btn--sm" onClick={() => rate(n)}>
              {n}★
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--block" onClick={onCleared}>
          Done
        </button>
      </div>
    </div>
  );
}
